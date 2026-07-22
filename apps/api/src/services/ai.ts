/**
 * AI Services — INDRA AI (PRD §2.3 — LangGraph StatefulGraph Architecture)
 *
 * Implements:
 *  - Prompt injection defense (§2.3 Prompt Injection Defense)
 *  - Confidence scoring + hallucination guard (§2.3 Hallucination Prevention)
 *  - Real Gemini 2.5 Flash Lite completions + text-embedding-004
 *  - Graceful mock fallback when GEMINI_API_KEY is not configured
 */

import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { BaseRetriever } from '@langchain/core/retrievers';
import { Document } from '@langchain/core/documents';
import { db } from './database';
import { vectorService } from './vector';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const COMPLETION_MODEL = process.env.COMPLETION_MODEL || 'gemini-2.5-flash';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-004';

const isGeminiConfigured =
  GEMINI_API_KEY.length > 10 &&
  !GEMINI_API_KEY.includes('replace-with');

// ---------------------------------------------------------------------------
// §2.3 — Prompt Injection Defense
// ---------------------------------------------------------------------------

export const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /you are now/i,
  /system:\s/i,
  /\[INST\]/i,
  /forget everything/i,
  /<\|im_start\|>/i,
  /disregard all/i,
  /pretend you are/i,
  /act as if/i,
  /jailbreak/i,
];

export function sanitizeInput(input: string): { safe: boolean; sanitized: string } {
  const detected = INJECTION_PATTERNS.some(p => p.test(input));
  if (detected) {
    return { safe: false, sanitized: '' };
  }
  // Strip HTML/script tags, limit length to 2000 chars per PRD
  const sanitized = input
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s.,?!'"()\-:;@#&*]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 2000)
    .trim();

  return { safe: true, sanitized };
}

// ---------------------------------------------------------------------------
// §2.3 — Hallucination Prevention / Confidence Scoring
// ---------------------------------------------------------------------------

export function evaluateConfidence(score: number): {
  action: 'deliver' | 'flag' | 'escalate';
  displayBadge: number;
} {
  const rounded = Math.round(score * 100);
  if (score >= 0.72) {
    return { action: 'deliver', displayBadge: rounded };
  } else if (score >= 0.5) {
    return { action: 'flag', displayBadge: rounded };
  } else {
    return { action: 'escalate', displayBadge: rounded };
  }
}

// ---------------------------------------------------------------------------
// Gemini — Chat Completions (Compatibility Wrapper)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function callOpenAI(
  messages: ChatMessage[],
  model: string = COMPLETION_MODEL,
  maxTokens: number = 500,
  temperature: number = 0.2,
): Promise<{ content: string; tokensUsed: number }> {
  if (!isGeminiConfigured) {
    // Mock response for local development without API key
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUser = userMessages[userMessages.length - 1]?.content || '';
    return {
      content: `[Mock Gemini Response] Based on your query "${lastUser.substring(0, 60)}...", here is a synthesized answer from the knowledge base. Configure GEMINI_API_KEY for real responses.`,
      tokensUsed: 45,
    };
  }

  try {
    const llm = new ChatGoogleGenerativeAI({
      apiKey: GEMINI_API_KEY,
      model: model,
      maxOutputTokens: maxTokens,
      temperature,
    });

    // Map role to LangChain format: system, ai, human
    const formattedMessages = messages.map(m => [
      m.role === 'system' ? 'system' : m.role === 'assistant' ? 'ai' : 'human',
      m.content
    ] as [string, string]);

    const response = await llm.invoke(formattedMessages);
    const content = response.content.toString();

    let tokensUsed = 0;
    if (response.response_metadata && typeof response.response_metadata === 'object') {
      const usage = (response.response_metadata as any).tokenUsage;
      if (usage && typeof usage.totalTokens === 'number') {
        tokensUsed = usage.totalTokens;
      }
    }

    return { content, tokensUsed };
  } catch (error) {
    console.warn(`[Gemini API] Exception (falling back to mock response):`, error);
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUser = userMessages[userMessages.length - 1]?.content || '';
    return {
      content: `[Mock Gemini Response - API Exception] Based on your query "${lastUser.substring(0, 60)}...", here is a fallback response.`,
      tokensUsed: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Gemini — Embeddings (text-embedding-004, dim=768)
// ---------------------------------------------------------------------------

export async function generateEmbedding(text: string): Promise<number[]> {
  const { sanitized } = sanitizeInput(text);
  const truncated = sanitized.slice(0, 8000); // model token limit safety

  if (!isGeminiConfigured) {
    // Return a deterministic mock vector (all zeros) for local dev
    return new Array(768).fill(0);
  }

  try {
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: GEMINI_API_KEY,
      modelName: EMBEDDING_MODEL,
    });
    
    return await embeddings.embedQuery(truncated);
  } catch (error) {
    console.warn(`[Gemini Embeddings] Exception (falling back to mock embeddings):`, error);
    return new Array(768).fill(0);
  }
}

// ---------------------------------------------------------------------------
// RAG — Synthesize Grounded Answer from Retrieved Context (§2.3)
// ---------------------------------------------------------------------------

export interface SourceDoc {
  id: string;
  title: string;
  type: string;
  bodyText: string;
  aiConfidence?: number | null;
}

// LangChain Custom Retriever implementation wrapping local VectorService + Prisma db
export class IndraVectorRetriever extends BaseRetriever {
  lc_namespace = ["indra", "retrievers"];

  constructor(private orgId: string, private collectionIds?: string[]) {
    super();
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const queryEmbedding = await generateEmbedding(query);
    const vectorHits = await vectorService.queryVector(
      this.orgId,
      queryEmbedding,
      10,
      this.collectionIds?.length ? { collectionId: this.collectionIds[0] } : undefined
    );

    const hitIds = Array.from(new Set(vectorHits.map(r => r.metadata.knowledgeId))).slice(0, 5);
    const groundingDocs = hitIds.length > 0
      ? await db.knowledgeEntry.findMany({
          where: { id: { in: hitIds }, orgId: this.orgId, status: 'published' },
          orderBy: { aiConfidence: 'desc' },
        })
      : [];

    return groundingDocs.map(doc => new Document({
      pageContent: doc.bodyText,
      metadata: {
        id: doc.id,
        title: doc.title,
        type: doc.type,
        aiConfidence: doc.aiConfidence,
      }
    }));
  }
}

export async function synthesizeAnswer(
  query: string,
  sources: SourceDoc[],
  maxTokens = 500,
): Promise<{ answer: string; confidence: number; tokensUsed: number }> {
  if (sources.length === 0) {
    return {
      answer: `I wasn't able to find specific documentation matching "${query}" in your knowledge base. Consider creating a new knowledge entry or asking a subject-matter expert.`,
      confidence: 0.5,
      tokensUsed: 0,
    };
  }

  if (!isGeminiConfigured) {
    const context = sources
      .slice(0, 5)
      .map((s, i) => `[${i + 1}] "${s.title}" (${s.type}):\n${s.bodyText.substring(0, 400)}`)
      .join('\n\n---\n\n');
    return {
      answer: `[Mock Gemini Response] Based on context:\n${context.substring(0, 200)}...\n\nAnswer to your query "${query}": Configure GEMINI_API_KEY for a real response.`,
      confidence: 0.85,
      tokensUsed: 40,
    };
  }

  // 1. Build grounding context from retrieved documents (§2.3 Retrieval Grounding)
  const context = sources
    .slice(0, 5)
    .map((s, i) => `[${i + 1}] "${s.title}" (${s.type}):\n${s.bodyText.substring(0, 400)}`)
    .join('\n\n---\n\n');

  // 2. Setup LangChain prompt template
  const systemPrompt = `You are INDRA AI, an enterprise knowledge assistant. Answer questions strictly based on the provided knowledge base context. Always cite sources using [1], [2] etc. If the context doesn't contain relevant information, say so clearly. Never fabricate information not present in the context.`;
  const template = `${systemPrompt}\n\nKnowledge Base Context:\n{context}\n\n---\n\nUser Question: {query}\n\nProvide a concise, accurate answer based only on the context above. Include source citations.`;
  
  const prompt = PromptTemplate.fromTemplate(template);

  // 3. Setup LangChain LLM ChatGoogleGenerativeAI
  const llm = new ChatGoogleGenerativeAI({
    apiKey: GEMINI_API_KEY,
    model: COMPLETION_MODEL,
    maxOutputTokens: maxTokens,
    temperature: 0.1, // low temperature for factual grounding
  });

  // 4. Create LCEL runnable chain
  const chain = RunnableSequence.from([
    prompt,
    llm,
  ]);

  // 5. Invoke the chain
  const response = await chain.invoke({
    context,
    query,
  });

  const responseText = response.content.toString();

  // Extract token usage if available in metadata
  let tokensUsed = 0;
  if (response.response_metadata && typeof response.response_metadata === 'object') {
    const usage = (response.response_metadata as any).tokenUsage;
    if (usage && typeof usage.totalTokens === 'number') {
      tokensUsed = usage.totalTokens;
    }
  }

  // Estimate confidence based on source quality and coverage
  const avgSourceConfidence = sources.reduce((sum, s) => sum + (s.aiConfidence || 0.85), 0) / sources.length;
  const confidence = Math.min(0.98, avgSourceConfidence * 1.05);

  return { answer: responseText, confidence, tokensUsed };
}

// ---------------------------------------------------------------------------
// NER — Entity Extraction for Knowledge Graph (§7.6 Ingestion Pipeline)
// ---------------------------------------------------------------------------

export async function extractEntities(text: string): Promise<Array<{
  name: string;
  type: 'person' | 'topic' | 'project' | 'team';
}>> {
  const { sanitized } = sanitizeInput(text);

  if (!isGeminiConfigured) {
    return [];
  }

  const llm = new ChatGoogleGenerativeAI({
    apiKey: GEMINI_API_KEY,
    model: COMPLETION_MODEL,
    maxOutputTokens: 200,
    temperature: 0,
  });

  const prompt = PromptTemplate.fromTemplate(
    `Extract named entities from the text. Respond with a JSON array of objects with "name" (string) and "type" ("person"|"topic"|"project"|"team") fields. Return at most 10 entities. Return only valid JSON.

Extract entities from:
{text}`
  );

  const chain = RunnableSequence.from([
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  const content = await chain.invoke({
    text: sanitized.slice(0, 1000),
  });

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as Array<{ name: string; type: 'person' | 'topic' | 'project' | 'team' }>;
    }
  } catch {
    // Fallback: return empty if parse fails
  }
  return [];
}

// LangChain-powered summarization helper F-004
export async function generateSummary(
  title: string,
  type: string,
  bodyText: string,
  styleInstruction: string,
  targetLength: number,
): Promise<{ summary: string; tokensUsed: number }> {
  if (!isGeminiConfigured) {
    return {
      summary: `[Mock Gemini Summary] Detailed summary of "${title}" (${type}) in style "${styleInstruction}".`,
      tokensUsed: 35,
    };
  }

  const llm = new ChatGoogleGenerativeAI({
    apiKey: GEMINI_API_KEY,
    model: COMPLETION_MODEL,
    maxOutputTokens: Math.ceil(targetLength / 3.5),
    temperature: 0.3,
  });

  const prompt = PromptTemplate.fromTemplate(
    `You are a precise knowledge summarizer. Summarize the provided content clearly and concisely. Do not add any information not present in the original text.

Style instructions: {styleInstruction}

Title: {title}
Type: {type}

Content:
{content}`
  );

  const chain = RunnableSequence.from([
    prompt,
    llm,
  ]);

  const response = await chain.invoke({
    title,
    type,
    styleInstruction,
    content: bodyText.substring(0, 3000),
  });

  const summary = response.content.toString().trim();
  
  let tokensUsed = 0;
  if (response.response_metadata && typeof response.response_metadata === 'object') {
    const usage = (response.response_metadata as any).tokenUsage;
    if (usage && typeof usage.totalTokens === 'number') {
      tokensUsed = usage.totalTokens;
    }
  }

  return { summary, tokensUsed };
}
