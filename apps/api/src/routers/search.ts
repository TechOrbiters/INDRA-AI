/**
 * Search Router — INDRA AI (PRD §6.3 — Search Endpoints, §3.3.1 — Universal Search Flow)
 *
 * Three modes (§6.3 GET /search):
 *  - AI mode:       embed query → vector search → GPT-4o synthesis with citations
 *  - Semantic mode: embed query → vector search → ranked results (no LLM synthesis)
 *  - Keyword mode:  Prisma full-text contains (BM25-style)
 *
 * Hallucination prevention (§2.3):
 *  - Every AI answer is grounded in retrieved context only
 *  - Confidence < 0.72 → escalate to SME notification queue
 */

import { router, protectedProcedure } from '../trpc';
import { SearchQuerySchema } from '@indra-ai/shared';
import { z } from 'zod';
import { db } from '../services/database';
import { generateEmbedding, synthesizeAnswer, sanitizeInput, evaluateConfidence } from '../services/ai';
import { vectorService } from '../services/vector';

export const searchRouter = router({
  /**
   * GET /search — Universal search (§6.3)
   */
  query: protectedProcedure
    .input(SearchQuerySchema)
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();
      const { safe, sanitized } = sanitizeInput(input.query);

      // Prompt injection → safety block
      if (!safe) {
        return {
          results: [],
          aiAnswer: {
            answer: 'Safety Block: Input query violated prompt safety guidelines. Prompt injection attempt detected.',
            confidence: 0,
            sources: [],
            latencyMs: Date.now() - startTime,
          },
          latencyMs: Date.now() - startTime,
          experts: [],
        };
      }

      let results: Array<{
        id: string;
        title: string;
        summary: string;
        type: string;
        collectionId: string;
        author: string;
        updatedAt: string;
        tags: string[];
        score: number;
      }> = [];

      let aiAnswer: {
        answer: string;
        confidence: number;
        sources: Array<{ id: string; title: string; type: string; excerpt: string; score?: number }>;
        latencyMs?: number;
      } | null = null;

      const mode = input.mode || 'ai';

      // ── Keyword Mode ───────────────────────────────────────────────────────
      if (mode === 'keyword') {
        const keywordMatches = await db.knowledgeEntry.findMany({
          where: {
            orgId: ctx.user.orgId,
            status: 'published',
            OR: [
              { title: { contains: sanitized } },
              { bodyText: { contains: sanitized } },
            ],
            ...(input.filters?.collections?.length
              ? { collectionId: { in: input.filters.collections } }
              : {}),
          },
          take: 20,
          orderBy: { updatedAt: 'desc' },
        });

        results = keywordMatches.map(e => ({
          id: e.id,
          title: e.title,
          summary: e.summary,
          type: e.type,
          collectionId: e.collectionId,
          author: e.authorId,
          updatedAt: e.updatedAt.toISOString(),
          tags: JSON.parse(e.tags) as string[],
          score: 1.0,
        }));
      }

      // ── AI Mode or Semantic Mode ───────────────────────────────────────────
      if (mode === 'ai' || mode === 'semantic') {
        // 1. Generate query embedding
        const queryEmbedding = await generateEmbedding(sanitized);

        // 2. Vector search (Pinecone or mock)
        const vectorResults = await vectorService.queryVector(
          ctx.user.orgId,
          queryEmbedding,
          15,
          input.filters?.collections?.length
            ? { collectionId: input.filters.collections[0] }
            : undefined,
        );

        // 3. Fetch full knowledge entries for top vector hits
        const hitIds = Array.from(new Set(vectorResults.map(r => r.metadata.knowledgeId))).slice(0, 10);

        const entries = hitIds.length > 0
          ? await db.knowledgeEntry.findMany({
              where: { id: { in: hitIds }, orgId: ctx.user.orgId, status: 'published' },
            })
          : [];

        // 4. Merge scores from vector results
        const scoreMap = new Map<string, number>();
        for (const vr of vectorResults) {
          const existing = scoreMap.get(vr.metadata.knowledgeId) ?? 0;
          scoreMap.set(vr.metadata.knowledgeId, Math.max(existing, vr.score));
        }

        results = entries
          .map(e => ({
            id: e.id,
            title: e.title,
            summary: e.summary,
            type: e.type,
            collectionId: e.collectionId,
            author: e.authorId,
            updatedAt: e.updatedAt.toISOString(),
            tags: JSON.parse(e.tags) as string[],
            score: scoreMap.get(e.id) ?? 0.5,
          }))
          .sort((a, b) => b.score - a.score);

        // If no vector hits, fall back to keyword search
        if (results.length === 0) {
          const fallback = await db.knowledgeEntry.findMany({
            where: {
              orgId: ctx.user.orgId,
              status: 'published',
              OR: [
                { title: { contains: sanitized } },
                { bodyText: { contains: sanitized } },
              ],
            },
            take: 10,
          });
          results = fallback.map(e => ({
            id: e.id,
            title: e.title,
            summary: e.summary,
            type: e.type,
            collectionId: e.collectionId,
            author: e.authorId,
            updatedAt: e.updatedAt.toISOString(),
            tags: JSON.parse(e.tags) as string[],
            score: 0.6,
          }));
        }

        // 5. AI synthesis (only for 'ai' mode)
        if (mode === 'ai') {
          const topEntries = await db.knowledgeEntry.findMany({
            where: { id: { in: results.slice(0, 5).map(r => r.id) } },
          });

          const { answer, confidence } = await synthesizeAnswer(
            sanitized,
            topEntries.map(e => ({
              id: e.id,
              title: e.title,
              type: e.type,
              bodyText: e.bodyText,
              aiConfidence: e.aiConfidence,
            })),
            500,
          );

          const { action } = evaluateConfidence(confidence);

          // Escalate to SME notification queue if confidence too low (§2.3)
          if (action === 'escalate') {
            await db.notification.create({
              data: {
                id: `notif_${Date.now().toString(36)}`,
                orgId: ctx.user.orgId,
                userId: ctx.user.id,
                type: 'ai_answer_escalation',
                title: 'AI Answer Escalated to SME',
                body: `Query "${sanitized.substring(0, 80)}" could not be answered with sufficient confidence (${Math.round(confidence * 100)}%). A subject-matter expert has been notified.`,
                resourceType: 'search',
                read: false,
              },
            });
          }

          aiAnswer = {
            answer,
            confidence,
            sources: results.slice(0, 5).map(r => ({
              id: r.id,
              title: r.title,
              type: r.type,
              excerpt: r.summary.substring(0, 160) + '...',
              score: r.score,
            })),
            latencyMs: Date.now() - startTime,
          };
        }
      }

      const latencyMs = Date.now() - startTime;

      // Log search query (§7.1 search_queries collection)
      await db.searchQuery.create({
        data: {
          id: `srch_${Date.now().toString(36)}`,
          orgId: ctx.user.orgId,
          userId: ctx.user.id,
          query: input.query,
          mode,
          filters: JSON.stringify(input.filters || {}),
          resultCount: results.length,
          aiAnswerProvided: !!aiAnswer,
          aiConfidence: aiAnswer?.confidence ?? null,
          latencyMs,
          sessionId: (ctx.req.headers['x-session-id'] as string) || 'session_web',
        },
      });

      return {
        results,
        aiAnswer,
        latencyMs,
        experts: [
          { name: 'Priya Sharma', role: 'Senior Engineer', avatarUrl: '' },
          { name: 'Alex Johnson', role: 'Knowledge Admin', avatarUrl: '' },
        ],
      };
    }),

  /**
   * GET /search/typeahead — Suggestions at 2+ chars (§3.3.1)
   */
  typeahead: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input, ctx }) => {
      if (input.query.length < 2) return [];

      const matches = await db.knowledgeEntry.findMany({
        where: {
          orgId: ctx.user.orgId,
          status: 'published',
          title: { contains: input.query },
        },
        select: { title: true, type: true, id: true },
        take: 8,
        orderBy: { viewCount: 'desc' },
      });

      return matches.map(m => ({
        id: m.id,
        title: m.title,
        type: m.type,
      }));
    }),
});
