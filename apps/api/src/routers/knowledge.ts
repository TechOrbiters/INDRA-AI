import { router, protectedProcedure } from '../trpc';
import { KnowledgeEntryCreateSchema, CollectionCreateSchema } from '@indra-ai/shared';
import { z } from 'zod';
import { db } from '../services/database';
import { TRPCError } from '@trpc/server';
import { ingestDocument, extractPdfText } from '../services/ingestion';
import { vectorService } from '../services/vector';

// Backwards-compat alias used by knowledge.test.ts
export const extractTextFromPdf = extractPdfText;


export const knowledgeRouter = router({
  create: protectedProcedure
    .input(KnowledgeEntryCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const entryId = `kn_${Math.random().toString(36).substring(2, 11)}`;

      // Generate AI summary if none provided
      const summary = input.summary || `AI Generated Summary for ${input.title}. Details: ${input.body.substring(0, 100)}...`;

      // Create log
      const entry = await db.knowledgeEntry.create({
        data: {
          id: entryId,
          orgId: ctx.user.orgId,
          title: input.title,
          summary,
          body: input.body,
          bodyText: input.body, // In real app, strip TipTap HTML/JSON to plain text
          type: input.type,
          status: 'published',
          visibility: input.visibility,
          collectionId: input.collectionId,
          tags: JSON.stringify(input.tags),
          aiTags: JSON.stringify(input.tags.map(t => `ai_${t}`)),
          authorId: ctx.user.id,
          contributorIds: JSON.stringify([ctx.user.id]),
          reviewerIds: JSON.stringify([]),
          version: 1,
          versionHistory: JSON.stringify([
            {
              version: 1,
              editedBy: ctx.user.displayName,
              editedAt: new Date().toISOString(),
              summary: 'Initial creation',
            },
          ]),
          metadata: JSON.stringify(input.metadata),
          embeddingModel: 'text-embedding-3-large',
          aiSummary: summary,
          aiConfidence: 0.96,
          healthScore: 100.0,
          viewCount: 0,
          bookmarkCount: 0,
          feedbackPositive: 0,
          feedbackNegative: 0,
        },
      });

      // Create matching Graph Entity representing the document (F-003)
      try {
        await db.graphEntity.create({
          data: {
            id: entry.id,
            orgId: ctx.user.orgId,
            entityType: 'document',
            name: entry.title,
            attributes: JSON.stringify({ type: entry.type, authorId: entry.authorId }),
          },
        });

        await db.graphRelationship.create({
          data: {
            id: `rel_${Date.now().toString(36)}`,
            orgId: ctx.user.orgId,
            sourceEntityId: ctx.user.id,
            targetEntityId: entry.id,
            relationshipType: 'authored',
            weight: 1.0,
          },
        });
      } catch {
        // Graph entity may already exist — non-fatal
      }

      // Trigger embedding + Pinecone ingestion (§7.6 — async, non-blocking)
      ingestDocument({
        orgId: ctx.user.orgId,
        title: entry.title,
        bodyText: entry.bodyText,
        body: entry.body,
        type: entry.type,
        collectionId: entry.collectionId,
        authorId: entry.authorId,
        tags: JSON.parse(entry.tags) as string[],
        visibility: entry.visibility,
        existingKnowledgeId: entry.id,
      }).catch(err => console.warn('[embedding] Failed to embed on create:', err));

      return entry;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const entry = await db.knowledgeEntry.findUnique({
        where: { id: input.id },
      });

      if (!entry || entry.orgId !== ctx.user.orgId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Knowledge entry not found or permission denied.',
        });
      }

      // Record audit view log F-006
      await db.auditEvent.create({
        data: {
          id: `evt_${Math.random().toString(36).substring(2, 11)}`,
          orgId: ctx.user.orgId,
          actorId: ctx.user.id,
          actorIp: '127.0.0.1',
          actorUserAgent: 'tRPC Client',
          action: 'knowledge.viewed',
          resourceType: 'knowledge',
          resourceId: entry.id,
        },
      });

      // Update view count
      await db.knowledgeEntry.update({
        where: { id: entry.id },
        data: { viewCount: { increment: 1 } },
      });

      return {
        ...entry,
        tags: JSON.parse(entry.tags),
        aiTags: JSON.parse(entry.aiTags),
        contributorIds: JSON.parse(entry.contributorIds),
        reviewerIds: JSON.parse(entry.reviewerIds),
        versionHistory: JSON.parse(entry.versionHistory),
        metadata: JSON.parse(entry.metadata),
      };
    }),

  list: protectedProcedure
    .input(z.object({ collectionId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const entries = await db.knowledgeEntry.findMany({
        where: {
          orgId: ctx.user.orgId,
          status: 'published',
          ...(input.collectionId ? { collectionId: input.collectionId } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });

      return entries.map((entry) => ({
        ...entry,
        tags: JSON.parse(entry.tags),
        aiTags: JSON.parse(entry.aiTags),
        contributorIds: JSON.parse(entry.contributorIds),
        reviewerIds: JSON.parse(entry.reviewerIds),
        versionHistory: JSON.parse(entry.versionHistory),
        metadata: JSON.parse(entry.metadata),
      }));
    }),

  createCollection: protectedProcedure
    .input(CollectionCreateSchema)
    .mutation(async ({ input, ctx }) => {
      const collectionId = `col_${input.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      const collection = await db.collection.create({
        data: {
          id: collectionId,
          orgId: ctx.user.orgId,
          name: input.name,
          description: input.description,
          parentId: input.parentId,
          icon: input.icon || '📁',
          color: input.color || '#0F62FE',
          ownerId: ctx.user.id,
          visibility: input.visibility,
          permissions: JSON.stringify({
            inheritFromOrg: true,
            explicit: {},
            teams: {},
          }),
          stats: JSON.stringify({
            entryCount: 0,
            viewsLast30Days: 0,
            healthScore: 100.0,
          }),
          createdBy: ctx.user.id,
        },
      });

      // Create Graph Entity representing the Topic Collection F-003
      await db.graphEntity.create({
        data: {
          id: collection.id,
          orgId: ctx.user.orgId,
          entityType: 'topic',
          name: collection.name,
          attributes: JSON.stringify({
            description: collection.description,
          }),
        },
      });

      return collection;
    }),

  listCollections: protectedProcedure.query(async ({ ctx }) => {
    let list = await db.collection.findMany({
      where: { orgId: ctx.user.orgId },
      orderBy: { name: 'asc' },
    });

    if (list.length === 0) {
      // Create a default collection on-the-fly to ensure the dropdown is never empty
      const defaultColId = `col_general_${ctx.user.orgId}`;
      const defaultCol = await db.collection.create({
        data: {
          id: defaultColId,
          orgId: ctx.user.orgId,
          name: 'General Wiki',
          description: 'General onboarding manuals and operational documentation.',
          ownerId: ctx.user.id,
          visibility: 'org',
          permissions: JSON.stringify({
            inheritFromOrg: true,
            explicit: {},
            teams: {},
          }),
          stats: JSON.stringify({
            entryCount: 0,
            viewsLast30Days: 0,
            healthScore: 100.0,
          }),
          createdBy: ctx.user.id,
        },
      });

      // Try creating Graph Entity as well
      try {
        await db.graphEntity.create({
          data: {
            id: defaultColId,
            orgId: ctx.user.orgId,
            entityType: 'topic',
            name: 'General Wiki',
            attributes: JSON.stringify({
              description: 'General onboarding manuals and operational documentation.',
            }),
          },
        });
      } catch {
        // Non-fatal
      }

      list = [defaultCol];
    }

    return list.map((col) => ({
      ...col,
      permissions: typeof col.permissions === 'string' ? JSON.parse(col.permissions) : col.permissions,
      stats: typeof col.stats === 'string' ? JSON.parse(col.stats) : col.stats,
    }));
  }),

  feedback: protectedProcedure
    .input(z.object({ id: z.string(), positive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const entry = await db.knowledgeEntry.findUnique({
        where: { id: input.id },
      });

      if (!entry || entry.orgId !== ctx.user.orgId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Knowledge entry not found.',
        });
      }

      await db.knowledgeEntry.update({
        where: { id: entry.id },
        data: input.positive
          ? { feedbackPositive: { increment: 1 } }
          : { feedbackNegative: { increment: 1 } },
      });

      return { success: true };
    }),

  bookmark: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const entry = await db.knowledgeEntry.findUnique({
        where: { id: input.id },
      });

      if (!entry || entry.orgId !== ctx.user.orgId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Knowledge entry not found.',
        });
      }

      // Increment bookmarkCount
      await db.knowledgeEntry.update({
        where: { id: entry.id },
        data: { bookmarkCount: { increment: 1 } },
      });

      return { success: true, bookmarked: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(3).optional(),
      summary: z.string().optional(),
      body: z.string().optional(),
      type: z.enum(['article', 'decision_log', 'how_to', 'faq', 'reference', 'meeting_note']).optional(),
      visibility: z.enum(['org', 'team', 'private']).optional(),
      collectionId: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(['draft', 'in_review', 'published', 'archived']).optional(),
      expiresAt: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
      editSummary: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const entry = await db.knowledgeEntry.findUnique({ where: { id: input.id } });

      if (!entry || entry.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Knowledge entry not found or access denied.' });
      }

      const currentHistory = JSON.parse(entry.versionHistory) as object[];
      const newVersion = entry.version + 1;
      const newHistoryEntry = {
        version: newVersion,
        editedBy: ctx.user.displayName,
        editedAt: new Date().toISOString(),
        summary: input.editSummary || 'Content updated',
      };

      const updated = await db.knowledgeEntry.update({
        where: { id: entry.id },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.summary !== undefined && { summary: input.summary }),
          ...(input.body !== undefined && { body: input.body, bodyText: input.body }),
          ...(input.type !== undefined && { type: input.type }),
          ...(input.visibility !== undefined && { visibility: input.visibility }),
          ...(input.collectionId !== undefined && { collectionId: input.collectionId }),
          ...(input.tags !== undefined && { tags: JSON.stringify(input.tags) }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.expiresAt !== undefined && { expiresAt: new Date(input.expiresAt) }),
          ...(input.metadata !== undefined && { metadata: JSON.stringify(input.metadata) }),
          version: newVersion,
          versionHistory: JSON.stringify([...currentHistory, newHistoryEntry]),
        },
      });

      // Audit log
      await db.auditEvent.create({
        data: {
          id: `evt_${Date.now().toString(36)}`,
          orgId: ctx.user.orgId,
          actorId: ctx.user.id,
          actorIp: ctx.req?.ip || '127.0.0.1',
          actorUserAgent: ctx.req?.headers?.['user-agent'] || 'tRPC Client',
          action: 'knowledge.updated',
          resourceType: 'knowledge',
          resourceId: entry.id,
          before: JSON.stringify({ title: entry.title, version: entry.version }),
          after: JSON.stringify({ title: updated.title, version: updated.version }),
        },
      });

      // Re-embed updated content (§7.6 — async, non-blocking)
      if (input.body !== undefined || input.title !== undefined) {
        ingestDocument({
          orgId: ctx.user.orgId,
          title: updated.title,
          bodyText: updated.bodyText,
          body: updated.body,
          type: updated.type,
          collectionId: updated.collectionId,
          authorId: updated.authorId,
          tags: JSON.parse(updated.tags) as string[],
          visibility: updated.visibility,
          existingKnowledgeId: updated.id,
        }).catch(err => console.warn('[embedding] Failed to re-embed on update:', err));
      }

      return {
        ...updated,
        tags: JSON.parse(updated.tags),
        aiTags: JSON.parse(updated.aiTags),
        versionHistory: JSON.parse(updated.versionHistory),
        metadata: JSON.parse(updated.metadata),
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const entry = await db.knowledgeEntry.findUnique({ where: { id: input.id } });

      if (!entry || entry.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Knowledge entry not found or access denied.' });
      }

      // Soft-delete: set deletedAt + status to archived
      await db.knowledgeEntry.update({
        where: { id: entry.id },
        data: {
          deletedAt: new Date(),
          status: 'archived',
        },
      });

      // Audit log
      await db.auditEvent.create({
        data: {
          id: `evt_${Math.random().toString(36).substring(2, 11)}`,
          orgId: ctx.user.orgId,
          actorId: ctx.user.id,
          actorIp: ctx.req?.ip || '127.0.0.1',
          actorUserAgent: ctx.req?.headers?.['user-agent'] || 'tRPC Client',
          action: 'knowledge.deleted',
          resourceType: 'knowledge',
          resourceId: entry.id,
          before: JSON.stringify({ title: entry.title, status: entry.status }),
          after: JSON.stringify({ status: 'archived', deletedAt: new Date().toISOString() }),
        },
      });

      // Remove vectors from Pinecone (§7.6 — non-blocking)
      vectorService.deleteVector(ctx.user.orgId, entry.id)
        .catch(err => console.warn('[embedding] Failed to delete vectors on archive:', err));

      return { success: true, id: entry.id };
    }),

  getVersions: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const entry = await db.knowledgeEntry.findUnique({ where: { id: input.id } });

      if (!entry || entry.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Knowledge entry not found.' });
      }

      const versions = JSON.parse(entry.versionHistory) as Array<{
        version: number;
        editedBy: string;
        editedAt: string;
        summary: string;
        bodySnapshot?: string;
      }>;

      return {
        id: entry.id,
        currentVersion: entry.version,
        versions,
      };
    }),

  parseUploadedFile: protectedProcedure
    .input(z.object({
      filename: z.string(),
      fileType: z.string(),
      base64Data: z.string(),
      collectionId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const fileBuffer = Buffer.from(input.base64Data, 'base64');

      // Extract text based on file type
      let bodyText = '';
      if (input.fileType === 'application/pdf') {
        bodyText = extractPdfText(fileBuffer);
      } else {
        bodyText = fileBuffer.toString('utf-8');
      }

      // Derive title from filename
      const title = input.filename
        .replace(/\.[^.]+$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      return {
        filename: input.filename,
        extractedText: bodyText,
        title,
        knowledgeId: '',
        chunksIndexed: 0,
        usedMockEmbeddings: false,
      };
    }),
});
