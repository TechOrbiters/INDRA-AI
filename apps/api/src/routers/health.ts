import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../services/database';
import { TRPCError } from '@trpc/server';

export const healthRouter = router({
  /**
   * Get organization-wide Knowledge Health overview statistics (§1.9 F-010)
   */
  getOverview: protectedProcedure.query(async ({ ctx }) => {
    const allEntries = await db.knowledgeEntry.findMany({
      where: { orgId: ctx.user.orgId, deletedAt: null },
    });

    const total = allEntries.length;
    if (total === 0) {
      return {
        overallHealthScore: 100,
        verifiedCount: 0,
        needsReviewCount: 0,
        outdatedCount: 0,
        lowConfidenceCount: 0,
        totalEntries: 0,
        verifiedPercentage: 100,
        needsReviewPercentage: 0,
        outdatedPercentage: 0,
      };
    }

    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    let verifiedCount = 0;
    let needsReviewCount = 0;
    let outdatedCount = 0;
    let lowConfidenceCount = 0;

    for (const entry of allEntries) {
      const isExpired = entry.expiresAt && new Date(entry.expiresAt) < now;
      const isStale = new Date(entry.updatedAt) < ninetyDaysAgo;
      const isLowConf = (entry.aiConfidence ?? 0) < 0.72;

      if (isExpired || isStale) {
        outdatedCount++;
      } else if (isLowConf || entry.status === 'in_review') {
        needsReviewCount++;
        if (isLowConf) lowConfidenceCount++;
      } else {
        verifiedCount++;
      }
    }

    const verifiedPercentage = Math.round((verifiedCount / total) * 100);
    const needsReviewPercentage = Math.round((needsReviewCount / total) * 100);
    const outdatedPercentage = Math.round((outdatedCount / total) * 100);

    // Weighted health score
    const overallHealthScore = Math.max(0, Math.min(100, Math.round(
      (verifiedPercentage * 1.0) + (needsReviewPercentage * 0.5) + (outdatedPercentage * 0.0)
    )));

    return {
      overallHealthScore,
      verifiedCount,
      needsReviewCount,
      outdatedCount,
      lowConfidenceCount,
      totalEntries: total,
      verifiedPercentage,
      needsReviewPercentage,
      outdatedPercentage,
    };
  }),

  /**
   * List entries in the Knowledge Health maintenance queue (§1.9 F-010)
   */
  listQueue: protectedProcedure
    .input(z.object({
      filter: z.enum(['all', 'outdated', 'needs_review', 'low_confidence']).default('all'),
    }))
    .query(async ({ input, ctx }) => {
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const entries = await db.knowledgeEntry.findMany({
        where: { orgId: ctx.user.orgId, deletedAt: null },
        orderBy: { updatedAt: 'asc' },
      });

      const queueItems = entries.map(entry => {
        const isExpired = entry.expiresAt && new Date(entry.expiresAt) < now;
        const isStale = new Date(entry.updatedAt) < ninetyDaysAgo;
        const isLowConf = (entry.aiConfidence ?? 0) < 0.72;

        let statusCategory: 'verified' | 'needs_review' | 'outdated' = 'verified';
        const flags: string[] = [];

        if (isExpired) {
          statusCategory = 'outdated';
          flags.push('Expired retention date');
        }
        if (isStale) {
          if (statusCategory !== 'outdated') statusCategory = 'outdated';
          flags.push('Not updated in 90+ days');
        }
        if (isLowConf) {
          if (statusCategory === 'verified') statusCategory = 'needs_review';
          flags.push(`Low AI confidence (${Math.round((entry.aiConfidence ?? 0) * 100)}%)`);
        }
        if (entry.status === 'in_review') {
          if (statusCategory === 'verified') statusCategory = 'needs_review';
          flags.push('Pending peer review');
        }

        return {
          id: entry.id,
          title: entry.title,
          summary: entry.summary,
          type: entry.type,
          status: entry.status,
          visibility: entry.visibility,
          authorId: entry.authorId,
          updatedAt: entry.updatedAt.toISOString(),
          viewCount: entry.viewCount,
          aiConfidence: entry.aiConfidence ?? 0.85,
          statusCategory,
          flags,
        };
      });

      if (input.filter === 'outdated') {
        return queueItems.filter(i => i.statusCategory === 'outdated');
      }
      if (input.filter === 'needs_review') {
        return queueItems.filter(i => i.statusCategory === 'needs_review');
      }
      if (input.filter === 'low_confidence') {
        return queueItems.filter(i => i.flags.some(f => f.includes('Low AI confidence')));
      }

      // 'all' returns non-verified items first
      return queueItems.filter(i => i.statusCategory !== 'verified');
    }),

  /**
   * Verify and refresh a knowledge entry (§1.9 F-010)
   */
  verifyEntry: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const entry = await db.knowledgeEntry.findUnique({ where: { id: input.id } });

      if (!entry || entry.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Knowledge entry not found.' });
      }

      const updated = await db.knowledgeEntry.update({
        where: { id: entry.id },
        data: {
          status: 'published',
          aiConfidence: 0.95,
          updatedAt: new Date(),
        },
      });

      // Log verification event in audit trail
      await db.auditEvent.create({
        data: {
          id: `evt_${Math.random().toString(36).substring(2, 11)}`,
          orgId: ctx.user.orgId,
          actorId: ctx.user.id,
          actorIp: ctx.actorIp || '127.0.0.1',
          actorUserAgent: ctx.actorUserAgent || 'tRPC Client',
          action: 'knowledge.verified',
          resourceType: 'knowledge',
          resourceId: entry.id,
          before: JSON.stringify({ aiConfidence: entry.aiConfidence, updatedAt: entry.updatedAt }),
          after: JSON.stringify({ aiConfidence: 0.95, updatedAt: updated.updatedAt }),
        },
      });

      return { success: true, id: updated.id, verifiedAt: updated.updatedAt.toISOString() };
    }),
});
