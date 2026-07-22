/**
 * Vector Service — INDRA AI (PRD §7.3 — Pinecone Vector Index Schema)
 *
 * Implements:
 *  - Pinecone upsert / query / delete via REST API (no SDK dependency)
 *  - Namespace isolation per org (${orgId})
 *  - Cosine similarity metric, dim=3072 (text-embedding-3-large)
 *  - Graceful in-memory mock when PINECONE_API_KEY is not configured
 */

const PINECONE_API_KEY = process.env.PINECONE_API_KEY || '';
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'indra-ai-prod';
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT || 'us-east-1-aws';

// Pinecone REST base URL (v1 controller API)
const isPineconeConfigured =
  PINECONE_API_KEY.length > 10 &&
  !PINECONE_API_KEY.startsWith('pcsk_replace') &&
  !PINECONE_API_KEY.includes('replace-with');

// Derive the Pinecone host from environment + index name
// Format: https://{index-name}-{project-id}.svc.{environment}.pinecone.io
// We'll resolve this lazily on first call via the Pinecone describe-index API
let pineconeHost: string | null = null;

async function getPineconeHost(): Promise<string> {
  if (pineconeHost) return pineconeHost;

  try {
    const res = await fetch(`https://api.pinecone.io/indexes/${PINECONE_INDEX_NAME}`, {
      headers: { 'Api-Key': PINECONE_API_KEY, 'X-Pinecone-API-Version': '2024-07' },
    });

    if (!res.ok) {
      const fallback = `https://${PINECONE_INDEX_NAME}.svc.${PINECONE_ENVIRONMENT}.pinecone.io`;
      pineconeHost = fallback;
      return fallback;
    }

    const data = await res.json() as { host?: string };
    pineconeHost = data.host || `https://${PINECONE_INDEX_NAME}.svc.${PINECONE_ENVIRONMENT}.pinecone.io`;
    return pineconeHost;
  } catch (err) {
    console.warn('[Pinecone] Failed to get index host (falling back to conventional host):', err);
    return `https://${PINECONE_INDEX_NAME}.svc.${PINECONE_ENVIRONMENT}.pinecone.io`;
  }
}

// ---------------------------------------------------------------------------
// In-Memory Mock Storage (used when Pinecone is not configured)
// ---------------------------------------------------------------------------

interface MockVector {
  id: string;
  values: number[];
  metadata: VectorMetadata;
  namespace: string;
}

const mockVectorStore: MockVector[] = [];

// Cosine similarity helper for mock mode
function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const normB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

// ---------------------------------------------------------------------------
// §7.3 — Vector Metadata Schema
// ---------------------------------------------------------------------------

export interface VectorMetadata {
  knowledgeId: string;
  orgId: string;
  chunkIndex: number;
  chunkText: string;
  title: string;
  type: string;
  collectionId: string;
  authorId: string;
  visibility: string;
  tags: string[];
  embeddingModel: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown; // allow indexing for Pinecone metadata compatibility
}

export interface VectorQueryResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const vectorService = {
  /**
   * Upsert a vector into Pinecone (or mock store).
   * Namespace is orgId for data isolation.
   */
  async upsertVector(
    id: string,
    values: number[],
    metadata: VectorMetadata,
  ): Promise<void> {
    if (!isPineconeConfigured) {
      const idx = mockVectorStore.findIndex(v => v.id === id && v.namespace === metadata.orgId);
      if (idx >= 0) {
        mockVectorStore[idx] = { id, values, metadata, namespace: metadata.orgId };
      } else {
        mockVectorStore.push({ id, values, metadata, namespace: metadata.orgId });
      }
      return;
    }

    try {
      const host = await getPineconeHost();
      const res = await fetch(`${host}/vectors/upsert`, {
        method: 'POST',
        headers: {
          'Api-Key': PINECONE_API_KEY,
          'Content-Type': 'application/json',
          'X-Pinecone-API-Version': '2024-07',
        },
        body: JSON.stringify({
          vectors: [{ id, values, metadata }],
          namespace: metadata.orgId,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn(`[Pinecone] Upsert failed with status ${res.status}: ${err}. Falling back to mock store.`);
        fallbackUpsert();
      }
    } catch (err) {
      console.warn(`[Pinecone] Upsert exception:`, err, `. Falling back to mock store.`);
      fallbackUpsert();
    }

    function fallbackUpsert() {
      const idx = mockVectorStore.findIndex(v => v.id === id && v.namespace === metadata.orgId);
      if (idx >= 0) {
        mockVectorStore[idx] = { id, values, metadata, namespace: metadata.orgId };
      } else {
        mockVectorStore.push({ id, values, metadata, namespace: metadata.orgId });
      }
    }
  },

  /**
   * Query similar vectors for the given org.
   * Returns top-K results ordered by cosine similarity.
   */
  async queryVector(
    orgId: string,
    queryVector: number[],
    topK = 10,
    filter?: Partial<VectorMetadata>,
  ): Promise<VectorQueryResult[]> {
    if (!isPineconeConfigured) {
      return mockQueryFallback();
    }

    try {
      const host = await getPineconeHost();
      const filterObj = filter ? { ...filter } : undefined;

      const res = await fetch(`${host}/query`, {
        method: 'POST',
        headers: {
          'Api-Key': PINECONE_API_KEY,
          'Content-Type': 'application/json',
          'X-Pinecone-API-Version': '2024-07',
        },
        body: JSON.stringify({
          vector: queryVector,
          topK,
          namespace: orgId,
          includeMetadata: true,
          ...(filterObj ? { filter: filterObj } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn(`[Pinecone] Query failed with status ${res.status}: ${err}. Falling back to mock search.`);
        return mockQueryFallback();
      }

      const data = await res.json() as {
        matches: Array<{ id: string; score: number; metadata: VectorMetadata }>;
      };

      return (data.matches || []).map(m => ({
        id: m.id,
        score: m.score,
        metadata: m.metadata,
      }));
    } catch (err) {
      console.warn(`[Pinecone] Query exception:`, err, `. Falling back to mock search.`);
      return mockQueryFallback();
    }

    function mockQueryFallback() {
      const orgVectors = mockVectorStore.filter(v => v.namespace === orgId);
      const scored = orgVectors.map(v => ({
        id: v.id,
        score: cosineSim(queryVector, v.values),
        metadata: v.metadata,
      }));
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    }
  },

  /**
   * Delete a vector (and all its chunks) from Pinecone by knowledge ID prefix.
   */
  async deleteVector(orgId: string, knowledgeId: string): Promise<void> {
    if (!isPineconeConfigured) {
      const before = mockVectorStore.length;
      const toRemove = mockVectorStore
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => v.namespace === orgId && v.id.startsWith(knowledgeId))
        .map(({ i }) => i)
        .reverse();
      for (const i of toRemove) mockVectorStore.splice(i, 1);
      console.info(`[mock vector] deleted ${before - mockVectorStore.length} chunks for ${knowledgeId}`);
      return;
    }

    try {
      const host = await getPineconeHost();
      const res = await fetch(`${host}/vectors/delete`, {
        method: 'POST',
        headers: {
          'Api-Key': PINECONE_API_KEY,
          'Content-Type': 'application/json',
          'X-Pinecone-API-Version': '2024-07',
        },
        body: JSON.stringify({
          filter: { knowledgeId: { '$eq': knowledgeId } },
          namespace: orgId,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn(`Pinecone delete warning: ${err}`);
      }
    } catch (err) {
      console.warn(`[Pinecone] Delete exception:`, err);
    }
  },

  /**
   * Return whether Pinecone is configured for live use.
   */
  isConfigured(): boolean {
    return isPineconeConfigured;
  },
};
