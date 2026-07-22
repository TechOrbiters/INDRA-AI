/**
 * Ingestion Service — INDRA AI (PRD §7.6 — Ingestion Pipeline Data Flow)
 *
 * Pipeline:
 *  Text Input → Chunker → Batch Embedding (OpenAI) → Pinecone Upsert → DB Record
 *
 * Chunking strategy (§7.6):
 *  - Chunk size: ~1,500 tokens (~6,000 chars)
 *  - Overlap:    ~200 tokens  (~800 chars)
 *  - Respects paragraph/sentence boundaries
 */

import { db } from './database';
import { generateEmbedding } from './ai';
import { vectorService, VectorMetadata } from './vector';
import { storageService } from './storage';

// ---------------------------------------------------------------------------
// Chunker — Recursive Character Splitting (§7.6)
// ---------------------------------------------------------------------------

const CHUNK_CHARS = 6000;   // ~1,500 tokens
const OVERLAP_CHARS = 800;  // ~200 tokens overlap

export function chunkText(text: string): string[] {
  if (text.length <= CHUNK_CHARS) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_CHARS, text.length);
    let boundary = end;

    // Respect paragraph boundaries where possible
    if (end < text.length) {
      const doubleNl = text.lastIndexOf('\n\n', end);
      const singleNl = text.lastIndexOf('\n', end);
      const period = text.lastIndexOf('. ', end);
      const bestBoundary = Math.max(doubleNl, singleNl, period);
      if (bestBoundary > start + CHUNK_CHARS / 2) {
        boundary = bestBoundary + 1;
      }
    }

    chunks.push(text.slice(start, boundary).trim());
    start = boundary - OVERLAP_CHARS; // Overlap for continuity
    if (start < 0) start = 0;
    if (boundary >= text.length) break;
  }

  return chunks.filter(c => c.length > 20);
}

// ---------------------------------------------------------------------------
// Core Ingestion Function
// ---------------------------------------------------------------------------

export interface IngestDocumentOptions {
  orgId: string;
  title: string;
  bodyText: string;
  body?: string;           // HTML/rich text version (optional)
  type?: string;
  collectionId?: string;
  authorId?: string;
  tags?: string[];
  visibility?: string;
  sourceIntegration?: {
    provider: string;
    externalId: string;
    externalUrl: string;
  };
  existingKnowledgeId?: string;  // If updating existing entry
}

export interface IngestDocumentResult {
  knowledgeId: string;
  chunksIndexed: number;
  embeddingModel: string;
  usedMockEmbeddings: boolean;
}

/**
 * Full ingestion pipeline per PRD §7.6:
 * 1. Save/update KnowledgeEntry in SQLite
 * 2. Chunk the text
 * 3. Batch-embed all chunks via OpenAI
 * 4. Upsert all chunks to Pinecone
 * 5. Update embeddingUpdatedAt on the DB record
 */
export async function ingestDocument(
  opts: IngestDocumentOptions,
): Promise<IngestDocumentResult> {
  const {
    orgId,
    title,
    bodyText,
    body = bodyText,
    type = 'article',
    collectionId = 'col_general',
    authorId = 'system',
    tags = [],
    visibility = 'org',
    sourceIntegration,
    existingKnowledgeId,
  } = opts;

  // 1. Create or update the KnowledgeEntry record
  const knowledgeId = existingKnowledgeId || `kn_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date();

  if (existingKnowledgeId) {
    await db.knowledgeEntry.update({
      where: { id: existingKnowledgeId },
      data: {
        title,
        body,
        bodyText,
        tags: JSON.stringify(tags),
        version: { increment: 1 },
        updatedAt: now,
        embeddingUpdatedAt: null, // will be set after embedding
        sourceIntegration: sourceIntegration ? JSON.stringify(sourceIntegration) : undefined,
      },
    });
  } else {
    await db.knowledgeEntry.create({
      data: {
        id: knowledgeId,
        orgId,
        title,
        summary: `${title} — ${bodyText.substring(0, 120)}...`,
        body,
        bodyText,
        type,
        status: 'published',
        visibility,
        collectionId,
        tags: JSON.stringify(tags),
        aiTags: JSON.stringify([]),
        authorId,
        contributorIds: JSON.stringify([authorId]),
        reviewerIds: JSON.stringify([]),
        version: 1,
        versionHistory: JSON.stringify([]),
        metadata: JSON.stringify({}),
        embeddingModel: 'text-embedding-3-large',
        aiConfidence: 0.88,
        healthScore: 85.0,
        viewCount: 0,
        bookmarkCount: 0,
        feedbackPositive: 0,
        feedbackNegative: 0,
        sourceIntegration: sourceIntegration ? JSON.stringify(sourceIntegration) : null,
        publishedAt: now,
      },
    });
  }

  // 2. Chunk the body text
  const chunks = chunkText(bodyText);
  let usedMockEmbeddings = false;

  // 3. Batch embed all chunks and upsert to Pinecone
  for (let i = 0; i < chunks.length; i++) {
    const chunkText_ = chunks[i];
    const chunkId = `${knowledgeId}_chunk_${String(i).padStart(3, '0')}`;

    const embedding = await generateEmbedding(`${title}\n\n${chunkText_}`);
    if (embedding.every(v => v === 0)) usedMockEmbeddings = true;

    const metadata: VectorMetadata = {
      knowledgeId,
      orgId,
      chunkIndex: i,
      chunkText: chunkText_.substring(0, 500), // store first 500 chars as preview
      title,
      type,
      collectionId,
      authorId,
      visibility,
      tags,
      embeddingModel: 'text-embedding-3-large',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await vectorService.upsertVector(chunkId, embedding, metadata);
  }

  // 4. Update embedding timestamp in DB
  await db.knowledgeEntry.update({
    where: { id: knowledgeId },
    data: { embeddingUpdatedAt: now },
  });

  console.info(`[ingestion] Indexed "${title}" — ${chunks.length} chunk(s) for org ${orgId}`);

  return {
    knowledgeId,
    chunksIndexed: chunks.length,
    embeddingModel: 'text-embedding-3-large',
    usedMockEmbeddings,
  };
}

// ---------------------------------------------------------------------------
// File Upload → Parse → Ingest (for the knowledge/create UI drag-and-drop)
// ---------------------------------------------------------------------------

export async function ingestUploadedFile(opts: {
  orgId: string;
  authorId: string;
  collectionId: string;
  filename: string;
  base64Content: string;
  mimeType: string;
}): Promise<{ title: string; bodyText: string; ingestResult: IngestDocumentResult }> {
  const { orgId, authorId, collectionId, filename, base64Content, mimeType } = opts;

  // Upload raw file to Supabase storage
  const fileBuffer = Buffer.from(base64Content, 'base64');
  const storagePath = `${orgId}/${Date.now()}_${filename}`;
  await storageService.uploadFile('indra-ai-ingestion', storagePath, fileBuffer, mimeType);

  // Extract text based on MIME type
  let bodyText = '';
  if (mimeType === 'application/pdf') {
    bodyText = extractPdfText(fileBuffer);
  } else {
    // TXT, MD, etc.
    bodyText = fileBuffer.toString('utf-8');
  }

  // Derive title from filename (strip extension, convert kebab/snake to words)
  const title = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const ingestResult = await ingestDocument({
    orgId,
    title,
    bodyText,
    authorId,
    collectionId,
    type: 'article',
    visibility: 'org',
  });

  return { title, bodyText, ingestResult };
}

// ---------------------------------------------------------------------------
// PDF text extractor (dependency-free regex stream parser)
// ---------------------------------------------------------------------------

export function extractPdfText(pdfBuffer: Buffer): string {
  const data = pdfBuffer.toString('binary');
  const regex = /\((.*?)\)\s*Tj|\[(.*?)\]\s*TJ/g;
  let match;
  let text = '';
  while ((match = regex.exec(data)) !== null) {
    if (match[1]) {
      text += match[1];
    } else if (match[2]) {
      const parts = match[2].match(/\((.*?)\)/g);
      if (parts) {
        text += parts.map(p => p.slice(1, -1)).join('') + ' ';
      }
    }
  }
  return text
    .replace(/\\([\d]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\(.)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
