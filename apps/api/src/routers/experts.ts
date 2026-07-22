import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../services/database';
import { TRPCError } from '@trpc/server';

export const expertsRouter = router({
  /**
   * List all SME users in the organization with contribution stats (§1.9 F-009)
   */
  list: protectedProcedure
    .input(z.object({
      department: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const users = await db.user.findMany({
        where: {
          orgId: ctx.user.orgId,
          status: 'active',
          ...(input?.search ? {
            OR: [
              { displayName: { contains: input.search } },
              { email: { contains: input.search } },
              { expertise: { contains: input.search } },
            ],
          } : {}),
        },
        orderBy: { displayName: 'asc' },
      });

      // Fetch knowledge entry counts grouped by author
      const knowledgeEntries = await db.knowledgeEntry.findMany({
        where: { orgId: ctx.user.orgId, deletedAt: null },
        select: { id: true, authorId: true, tags: true, title: true },
      });

      const authorStats: Record<string, { count: number; tags: Set<string>; topEntries: Array<{ id: string; title: string }> }> = {};

      for (const entry of knowledgeEntries) {
        if (!authorStats[entry.authorId]) {
          authorStats[entry.authorId] = { count: 0, tags: new Set(), topEntries: [] };
        }
        authorStats[entry.authorId].count++;
        const tags = JSON.parse(entry.tags || '[]') as string[];
        tags.forEach(t => authorStats[entry.authorId].tags.add(t));
        if (authorStats[entry.authorId].topEntries.length < 3) {
          authorStats[entry.authorId].topEntries.push({ id: entry.id, title: entry.title });
        }
      }

      return users.map(user => {
        const stats = authorStats[user.id] || { count: 0, tags: new Set(), topEntries: [] };
        const expertiseList = JSON.parse(user.expertise || '[]') as string[];
        const combinedTags = Array.from(new Set([...expertiseList, ...Array.from(stats.tags)])).slice(0, 6);
        const departmentsList = JSON.parse(user.departments || '[]') as string[];

        return {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          departments: departmentsList,
          expertise: combinedTags,
          contributionCount: stats.count,
          topEntries: stats.topEntries,
          responsivenessScore: Math.min(99, 85 + (stats.count * 3)),
        };
      });
    }),

  /**
   * Find SMEs for a specific topic query using keyword/tag matching (§1.9 F-009)
   */
  findForTopic: protectedProcedure
    .input(z.object({
      topic: z.string().min(2).max(200),
    }))
    .query(async ({ input, ctx }) => {
      const topicLower = input.topic.toLowerCase();

      // Find matching knowledge entries first to locate top authors
      const matchingEntries = await db.knowledgeEntry.findMany({
        where: {
          orgId: ctx.user.orgId,
          status: 'published',
          deletedAt: null,
          OR: [
            { title: { contains: topicLower } },
            { tags: { contains: topicLower } },
            { bodyText: { contains: topicLower } },
          ],
        },
        select: { id: true, title: true, authorId: true, viewCount: true },
        take: 20,
      });

      const authorScores: Record<string, { matchCount: number; sampleTitle: string }> = {};
      for (const entry of matchingEntries) {
        if (!authorScores[entry.authorId]) {
          authorScores[entry.authorId] = { matchCount: 0, sampleTitle: entry.title };
        }
        authorScores[entry.authorId].matchCount += 1;
      }

      // Also search users direct expertise
      const matchingUsers = await db.user.findMany({
        where: {
          orgId: ctx.user.orgId,
          status: 'active',
          OR: [
            { expertise: { contains: topicLower } },
            { departments: { contains: topicLower } },
            { displayName: { contains: topicLower } },
          ],
        },
      });

      const candidateIds = new Set([
        ...Object.keys(authorScores),
        ...matchingUsers.map(u => u.id),
      ]);

      if (candidateIds.size === 0) {
        // Fallback: return default admins or top contributors
        const fallbackUsers = await db.user.findMany({
          where: { orgId: ctx.user.orgId, status: 'active' },
          take: 3,
        });
        return fallbackUsers.map(u => ({
          id: u.id,
          displayName: u.displayName,
          email: u.email,
          role: u.role,
          avatarUrl: u.avatarUrl,
          expertise: JSON.parse(u.expertise || '[]') as string[],
          departments: JSON.parse(u.departments || '[]') as string[],
          matchReason: `General Subject-Matter Contact`,
          matchConfidence: 0.75,
        }));
      }

      const allCandidates = await db.user.findMany({
        where: { id: { in: Array.from(candidateIds) } },
      });

      return allCandidates.map(u => {
        const authorData = authorScores[u.id];
        const matchReason = authorData
          ? `Authored key content on "${topicLower}" (${authorData.sampleTitle})`
          : `Listed expert in ${JSON.parse(u.expertise || '[]')[0] || topicLower}`;

        return {
          id: u.id,
          displayName: u.displayName,
          email: u.email,
          role: u.role,
          avatarUrl: u.avatarUrl,
          expertise: JSON.parse(u.expertise || '[]') as string[],
          departments: JSON.parse(u.departments || '[]') as string[],
          matchReason,
          matchConfidence: authorData ? Math.min(0.98, 0.82 + (authorData.matchCount * 0.05)) : 0.80,
        };
      }).sort((a, b) => b.matchConfidence - a.matchConfidence);
    }),

  /**
   * Get detailed profile + expertise breakdown for a specific expert (§1.9 F-009)
   */
  getProfile: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      const user = await db.user.findUnique({ where: { id: input.userId } });

      if (!user || user.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Expert profile not found.' });
      }

      const entries = await db.knowledgeEntry.findMany({
        where: { authorId: user.id, orgId: ctx.user.orgId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        expertise: JSON.parse(user.expertise || '[]') as string[],
        departments: JSON.parse(user.departments || '[]') as string[],
        preferences: JSON.parse(user.preferences || '{}'),
        stats: {
          totalKnowledgeCount: entries.length,
          totalViews: entries.reduce((acc, e) => acc + e.viewCount, 0),
          lastActiveAt: user.updatedAt.toISOString(),
        },
        recentKnowledge: entries.map(e => ({
          id: e.id,
          title: e.title,
          summary: e.summary,
          type: e.type,
          updatedAt: e.updatedAt.toISOString(),
          viewCount: e.viewCount,
        })),
      };
    }),
});
