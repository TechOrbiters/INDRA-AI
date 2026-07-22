/**
 * AI Router — INDRA AI (PRD §6.5 — AI Endpoints)
 *
 * Endpoints:
 *  - answer:      POST /ai/answer — RAG Q&A with source citations + confidence scoring
 *  - summarize:   POST /ai/summarize — GPT-4o knowledge summarization (brief/detailed/bullets)
 *  - suggestTags: POST /ai/tags/suggest — NLP keyword extraction for auto-tagging
 */

import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../services/database';
import { generateEmbedding, synthesizeAnswer, sanitizeInput, evaluateConfidence, generateSummary } from '../services/ai';
import { vectorService } from '../services/vector';
import { TRPCError } from '@trpc/server';

export const aiRouter = router({
  /**
   * POST /ai/answer — Direct Q&A with grounding + confidence scoring (§6.5)
   *
   * Pipeline: sanitize → embed → vector search → GPT-4o synthesis → confidence gate
   */
  answer: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(500),
      context: z.object({
        collectionIds: z.array(z.string()).optional(),
        maxTokens: z.number().optional().default(500),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();

      // Safety gate (§2.3 — Prompt Injection Defense)
      const { safe, sanitized } = sanitizeInput(input.query);
      if (!safe) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'AI_CONTENT_POLICY: Query violated content safety policy.',
        });
      }

      // 1. Generate query embedding
      const queryEmbedding = await generateEmbedding(sanitized);

      // 2. Vector similarity search for grounding context
      const vectorHits = await vectorService.queryVector(
        ctx.user.orgId,
        queryEmbedding,
        10,
        input.context?.collectionIds?.length
          ? { collectionId: input.context.collectionIds[0] }
          : undefined,
      );

      // 3. Fetch full entries for top hits
      const hitIds = Array.from(new Set(vectorHits.map(r => r.metadata.knowledgeId))).slice(0, 5);
      const groundingDocs = hitIds.length > 0
        ? await db.knowledgeEntry.findMany({
            where: { id: { in: hitIds }, orgId: ctx.user.orgId, status: 'published' },
            orderBy: { aiConfidence: 'desc' },
          })
        : await db.knowledgeEntry.findMany({
            where: {
              orgId: ctx.user.orgId,
              status: 'published',
              OR: [{ title: { contains: sanitized } }, { bodyText: { contains: sanitized } }],
            },
            take: 5,
            orderBy: { aiConfidence: 'desc' },
          });

      // 4. GPT-4o synthesis (§2.3 — Response Synthesis)
      const { answer, confidence, tokensUsed } = await synthesizeAnswer(
        sanitized,
        groundingDocs.map(d => ({
          id: d.id,
          title: d.title,
          type: d.type,
          bodyText: d.bodyText,
          aiConfidence: d.aiConfidence,
        })),
        input.context?.maxTokens ?? 500,
      );

      const { action, displayBadge } = evaluateConfidence(confidence);

      // Escalate low-confidence to SME (§2.3 — Human-in-the-Loop)
      if (action === 'escalate') {
        await db.notification.create({
          data: {
            id: `notif_${Date.now().toString(36)}`,
            orgId: ctx.user.orgId,
            userId: ctx.user.id,
            type: 'ai_answer_escalation',
            title: 'AI Answer Escalated to SME',
            body: `Query "${sanitized.substring(0, 60)}..." could not be answered with sufficient confidence. A subject-matter expert has been notified.`,
            resourceType: 'search',
            read: false,
          },
        });
      }

      const latencyMs = Date.now() - startTime;

      return {
        answer,
        confidence,
        confidenceBadge: displayBadge,
        confidenceAction: action,
        sources: groundingDocs.slice(0, 3).map(d => ({
          id: d.id,
          title: d.title,
          type: d.type,
          excerpt: d.bodyText.substring(0, 120) + '...',
        })),
        tokensUsed,
        latencyMs,
      };
    }),

  /**
   * POST /ai/summarize — GPT-4o knowledge summarization (§6.5)
   */
  summarize: protectedProcedure
    .input(z.object({
      knowledgeId: z.string(),
      style: z.enum(['brief', 'detailed', 'bullets']).default('brief'),
      targetLength: z.number().min(50).max(1000).default(200),
    }))
    .mutation(async ({ input, ctx }) => {
      const entry = await db.knowledgeEntry.findUnique({ where: { id: input.knowledgeId } });

      if (!entry || entry.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Knowledge entry not found.' });
      }

      const styleInstructions: Record<string, string> = {
        brief: `Summarize in 2–3 sentences, approximately ${input.targetLength} characters.`,
        detailed: `Write a comprehensive summary with headings and key details, approximately ${input.targetLength} characters.`,
        bullets: `Summarize as 4–6 concise bullet points, approximately ${input.targetLength} characters total.`,
      };

      const { summary, tokensUsed } = await generateSummary(
        entry.title,
        entry.type,
        entry.bodyText,
        styleInstructions[input.style],
        input.targetLength,
      );

      // Persist AI summary back to the record
      await db.knowledgeEntry.update({
        where: { id: entry.id },
        data: { aiSummary: summary },
      });

      return {
        summary,
        style: input.style,
        originalTitle: entry.title,
        characterCount: summary.length,
        tokensUsed,
      };
    }),

  /**
   * POST /ai/tags/suggest — Auto-suggest tags from body content (§6.5)
   *
   * Uses frequency-analysis NLP (no LLM call needed — low latency, no cost).
   */
  suggestTags: protectedProcedure
    .input(z.object({
      body: z.string().min(10).max(5000),
    }))
    .mutation(async ({ input }) => {
      const { safe, sanitized } = sanitizeInput(input.body);
      if (!safe) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Content contains disallowed patterns.' });
      }

      const stopwords = new Set([
        'the', 'is', 'in', 'and', 'of', 'to', 'a', 'an', 'for', 'on', 'with', 'at', 'by',
        'from', 'as', 'this', 'that', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
        'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
        'shall', 'can', 'not', 'it', 'its', 'or', 'but', 'if', 'so', 'yet', 'nor', 'both',
        'either', 'neither', 'we', 'our', 'their', 'they', 'also', 'then', 'than', 'which',
        'who', 'what', 'when', 'where', 'how', 'all', 'each', 'every', 'more', 'very',
      ]);

      const words = sanitized
        .toLowerCase()
        .replace(/[^a-z0-9\s\-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopwords.has(w));

      const freq: Record<string, number> = {};
      for (const word of words) {
        freq[word] = (freq[word] || 0) + 1;
      }

      const sorted = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([word, count]) => ({
          tag: word,
          confidence: Math.min(0.99, (count / Math.max(words.length, 1)) * 15),
        }));

      const tags = sorted.map(t => t.tag);
      const confidence: Record<string, number> = {};
      for (const t of sorted) {
        confidence[t.tag] = parseFloat(t.confidence.toFixed(2));
      }

      return { tags, confidence };
    }),
});
