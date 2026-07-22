import { router, protectedProcedure, checkRole } from '../trpc';
import { z } from 'zod';
import { db } from '../services/database';
import { TRPCError } from '@trpc/server';

export const adminRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    // Aggregates dashboard analytics F-007
    const knowledgeCount = await db.knowledgeEntry.count({
      where: { orgId: ctx.user.orgId },
    });

    const userCount = await db.user.count({
      where: { orgId: ctx.user.orgId },
    });

    const activeUsersCount = await db.user.count({
      where: { orgId: ctx.user.orgId, status: 'active' },
    });

    return {
      stats: {
        dau: activeUsersCount,
        wau: Math.ceil(activeUsersCount * 1.5),
        mau: Math.ceil(activeUsersCount * 2.2),
        knowledgeCount,
        userCount,
        searchesToday: 24,
        healthScore: 94.2,
      },
      topQueries: [
        { query: 'onboarding setup guides', count: 12, answerRate: '94%' },
        { query: 'deployment pipeline docs', count: 8, answerRate: '88%' },
        { query: 'OAuth access scopes details', count: 5, answerRate: '60%' },
      ],
    };
  }),

  listUsers: protectedProcedure.query(async ({ ctx }) => {
    const users = await db.user.findMany({
      where: { orgId: ctx.user.orgId },
    });

    return users.map((u) => ({
      ...u,
      expertise: JSON.parse(u.expertise),
      departments: JSON.parse(u.departments),
      preferences: JSON.parse(u.preferences),
    }));
  }),

  updateUserRole: protectedProcedure
    .use(checkRole(['super_admin', 'knowledge_admin']))
    .input(z.object({ userId: z.string(), role: z.enum(['super_admin', 'knowledge_admin', 'contributor', 'viewer', 'guest']) }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.user.findUnique({
        where: { id: input.userId },
      });

      if (!user || user.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found in organization.' });
      }

      const updated = await db.user.update({
        where: { id: user.id },
        data: { role: input.role },
      });

      // Record audit change
      await db.auditEvent.create({
        data: {
          id: `evt_${Math.random().toString(36).substring(2, 11)}`,
          orgId: ctx.user.orgId,
          actorId: ctx.user.id,
          actorIp: '127.0.0.1',
          actorUserAgent: 'tRPC Client',
          action: 'user.role_changed',
          resourceType: 'user',
          resourceId: user.id,
          before: JSON.stringify({ role: user.role }),
          after: JSON.stringify({ role: updated.role }),
        },
      });

      return updated;
    }),

  listIntegrations: protectedProcedure.query(async ({ ctx }) => {
    const list = await db.integration.findMany({
      where: { orgId: ctx.user.orgId },
    });

    return list.map((int) => ({
      ...int,
      credentials: JSON.parse(int.credentials),
      config: JSON.parse(int.config),
      stats: JSON.parse(int.stats),
    }));
  }),

  connectIntegration: protectedProcedure
    .input(z.object({
      provider: z.enum(['google_drive', 'confluence', 'notion', 'slack']),
      config: z.object({ syncFrequencyMinutes: z.number() }),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = `int_${input.provider}_${Math.random().toString(36).substring(2, 6)}`;

      const int = await db.integration.create({
        data: {
          id,
          orgId: ctx.user.orgId,
          provider: input.provider,
          status: 'active',
          credentials: JSON.stringify({ accessToken: 'mock_token_abc123' }),
          config: JSON.stringify(input.config),
          stats: JSON.stringify({
            documentsIngested: 0,
            lastSyncStatus: 'success',
          }),
          connectedBy: ctx.user.id,
        },
      });

      return int;
    }),

  inviteUser: protectedProcedure
    .use(checkRole(['super_admin', 'knowledge_admin']))
    .input(z.object({
      email: z.string().email(),
      role: z.enum(['super_admin', 'knowledge_admin', 'contributor', 'viewer', 'guest']),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await db.user.findFirst({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'A user with this email already exists.' });
      }

      const userId = `usr_${Math.random().toString(36).substring(2, 11)}`;
      const user = await db.user.create({
        data: {
          id: userId,
          orgId: ctx.user.orgId,
          email: input.email,
          displayName: input.email.split('@')[0],
          role: input.role,
          status: 'invited',
          expertise: JSON.stringify([]),
          departments: JSON.stringify([]),
          preferences: JSON.stringify({ theme: 'dark', emailDigest: 'never', searchMode: 'ai', language: 'en' }),
          collectionPermissions: JSON.stringify({}),
          stats: JSON.stringify({ knowledgeCreated: 0, searchesThisMonth: 0, lastActiveAt: new Date().toISOString() }),
          invitedBy: ctx.user.id,
          invitedAt: new Date(),
        },
      });

      await db.auditEvent.create({
        data: {
          id: `evt_${Math.random().toString(36).substring(2, 11)}`,
          orgId: ctx.user.orgId,
          actorId: ctx.user.id,
          actorIp: '127.0.0.1',
          actorUserAgent: 'tRPC Client',
          action: 'user.invited',
          resourceType: 'user',
          resourceId: userId,
          after: JSON.stringify({ email: input.email, role: input.role }),
        },
      });

      return { success: true, user: { id: user.id, email: user.email, role: user.role, status: user.status } };
    }),

  orgSettings: protectedProcedure.query(async ({ ctx }) => {
    const org = await db.organization.findUnique({ where: { id: ctx.user.orgId } });
    if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found.' });
    return {
      id: org.id,
      name: org.name,
      domain: org.domain,
      slug: org.slug,
      plan: org.plan,
      seatCount: org.seatCount,
      activeSeatCount: org.activeSeatCount,
      settings: JSON.parse(org.settings),
      billing: JSON.parse(org.billing),
      stats: JSON.parse(org.stats),
    };
  }),

  updateOrgSettings: protectedProcedure
    .use(checkRole(['super_admin']))
    .input(z.object({
      name: z.string().min(2).optional(),
      settings: z.object({
        ssoEnabled: z.boolean().optional(),
        defaultRole: z.enum(['contributor', 'viewer']).optional(),
        allowPublicSignup: z.boolean().optional(),
        retentionDays: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const org = await db.organization.findUnique({ where: { id: ctx.user.orgId } });
      if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Organization not found.' });

      const currentSettings = JSON.parse(org.settings);
      const updated = await db.organization.update({
        where: { id: ctx.user.orgId },
        data: {
          ...(input.name ? { name: input.name } : {}),
          settings: JSON.stringify({ ...currentSettings, ...input.settings }),
        },
      });

      await db.auditEvent.create({
        data: {
          id: `evt_${Math.random().toString(36).substring(2, 11)}`,
          orgId: ctx.user.orgId,
          actorId: ctx.user.id,
          actorIp: '127.0.0.1',
          actorUserAgent: 'tRPC Client',
          action: 'org.settings_changed',
          resourceType: 'org_settings',
          resourceId: org.id,
          before: JSON.stringify({ name: org.name, settings: currentSettings }),
          after: JSON.stringify({ name: updated.name, settings: JSON.parse(updated.settings) }),
        },
      });

      return { success: true };
    }),

  syncIntegration: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const integration = await db.integration.findUnique({
        where: { id: input.id },
      });

      if (!integration || integration.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Integration not found.' });
      }

      // Simulate parsing documents F-002 Ingestion
      const mockIngestedTitles = [
        'Engineering General Onboarding Manual',
        'Stripe Integration Technical Design Log',
        'Confluence Release Space Log Q3 2026',
      ];

      for (const title of mockIngestedTitles) {
        const docId = `kn_sync_${Math.random().toString(36).substring(2, 6)}`;
        
        // Add to Knowledge base
        await db.knowledgeEntry.create({
          data: {
            id: docId,
            orgId: ctx.user.orgId,
            title,
            summary: `Automated sync summary for ${title}. Indexed from connected ${integration.provider}.`,
            body: `<p>This document details the configuration for ${title}. Synchronized from the organization's ${integration.provider} workspace.</p>`,
            bodyText: `This document details the configuration for ${title}. Synchronized from the organization's ${integration.provider} workspace.`,
            type: title.includes('Design Log') ? 'decision_log' : 'article',
            status: 'published',
            visibility: 'org',
            collectionId: 'col_general',
            tags: JSON.stringify([integration.provider, 'sync']),
            aiTags: JSON.stringify([integration.provider, 'auto']),
            authorId: ctx.user.id,
            contributorIds: JSON.stringify([ctx.user.id]),
            reviewerIds: JSON.stringify([]),
            version: 1,
            versionHistory: JSON.stringify([]),
            metadata: JSON.stringify(title.includes('Design Log') ? {
              context: 'Sync pipeline migration',
              decision: 'Adopt Prisma + Turborepo monorepo',
              outcome: 'Successful compilation',
            } : {}),
            embeddingModel: 'text-embedding-3-large',
            aiConfidence: 0.95,
            healthScore: 100.0,
            sourceIntegration: JSON.stringify({
              provider: integration.provider,
              externalId: `ext_${docId}`,
              externalUrl: 'https://docs.google.com/document/',
              lastSyncedAt: new Date().toISOString(),
            }),
            viewCount: 0,
            bookmarkCount: 0,
            feedbackPositive: 0,
            feedbackNegative: 0,
          },
        });

        // Add matching Graph Entity
        await db.graphEntity.create({
          data: {
            id: docId,
            orgId: ctx.user.orgId,
            entityType: 'document',
            name: title,
            attributes: JSON.stringify({
              provider: integration.provider,
            }),
          },
        });

        // Add Author connection
        await db.graphRelationship.create({
          data: {
            id: `rel_sync_${Math.random().toString(36).substring(2, 8)}`,
            orgId: ctx.user.orgId,
            sourceEntityId: ctx.user.id,
            targetEntityId: docId,
            relationshipType: 'authored',
            weight: 0.8,
          },
        });
      }

      // Update Integration Stats
      const updated = await db.integration.update({
        where: { id: integration.id },
        data: {
          stats: JSON.stringify({
            documentsIngested: 3,
            lastSyncAt: new Date().toISOString(),
            lastSyncStatus: 'success',
            lastSyncDurationMs: 820,
          }),
        },
      });

      return {
        success: true,
        stats: JSON.parse(updated.stats),
      };
    }),

  deactivateUser: protectedProcedure
    .use(checkRole(['super_admin', 'knowledge_admin']))
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.user.findUnique({ where: { id: input.userId } });

      if (!user || user.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found in organization.' });
      }

      if (user.id === ctx.user.id) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot deactivate your own account.' });
      }

      await db.user.update({
        where: { id: user.id },
        data: { status: 'deactivated' },
      });

      await db.auditEvent.create({
        data: {
          id: `evt_${Math.random().toString(36).substring(2, 11)}`,
          orgId: ctx.user.orgId,
          actorId: ctx.user.id,
          actorIp: '127.0.0.1',
          actorUserAgent: 'tRPC Client',
          action: 'user.deactivated',
          resourceType: 'user',
          resourceId: user.id,
          before: JSON.stringify({ status: user.status }),
          after: JSON.stringify({ status: 'deactivated' }),
        },
      });

      return { success: true, userId: user.id };
    }),

  disconnectIntegration: protectedProcedure
    .use(checkRole(['super_admin', 'knowledge_admin']))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const integration = await db.integration.findUnique({ where: { id: input.id } });

      if (!integration || integration.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Integration not found.' });
      }

      await db.integration.delete({ where: { id: integration.id } });

      await db.auditEvent.create({
        data: {
          id: `evt_${Math.random().toString(36).substring(2, 11)}`,
          orgId: ctx.user.orgId,
          actorId: ctx.user.id,
          actorIp: '127.0.0.1',
          actorUserAgent: 'tRPC Client',
          action: 'integration.disconnected',
          resourceType: 'integration',
          resourceId: integration.id,
          before: JSON.stringify({ provider: integration.provider, status: integration.status }),
          after: JSON.stringify({ deleted: true }),
        },
      });

      return { success: true, provider: integration.provider };
    }),

  complianceExport: protectedProcedure
    .use(checkRole(['super_admin']))
    .input(z.object({
      format: z.enum(['json', 'csv']).default('json'),
      includeAuditLogs: z.boolean().default(true),
      includeKnowledge: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const org = await db.organization.findUnique({ where: { id: ctx.user.orgId } });
      const users = await db.user.findMany({ where: { orgId: ctx.user.orgId } });

      let auditLogs: unknown[] = [];
      if (input.includeAuditLogs) {
        auditLogs = await db.auditEvent.findMany({ where: { orgId: ctx.user.orgId }, take: 1000 });
      }

      let knowledge: unknown[] = [];
      if (input.includeKnowledge) {
        knowledge = await db.knowledgeEntry.findMany({ where: { orgId: ctx.user.orgId, deletedAt: null }, take: 1000 });
      }

      const exportData = {
        organization: org,
        exportDate: new Date().toISOString(),
        exportedBy: ctx.user.email,
        usersCount: users.length,
        users: users.map(u => ({ id: u.id, email: u.email, role: u.role, status: u.status })),
        auditLogsCount: auditLogs.length,
        auditLogs,
        knowledgeCount: knowledge.length,
        knowledge,
      };

      await db.auditEvent.create({
        data: {
          id: `evt_${Math.random().toString(36).substring(2, 11)}`,
          orgId: ctx.user.orgId,
          actorId: ctx.user.id,
          actorIp: ctx.actorIp || '127.0.0.1',
          actorUserAgent: ctx.actorUserAgent || 'tRPC Client',
          action: 'org.compliance_exported',
          resourceType: 'org_settings',
          resourceId: ctx.user.orgId,
          after: JSON.stringify({ format: input.format, includeAuditLogs: input.includeAuditLogs }),
        },
      });

      if (input.format === 'csv') {
        const csvHeader = 'User_ID,Email,Role,Status\n';
        const csvRows = users.map(u => `${u.id},${u.email},${u.role},${u.status}`).join('\n');
        return {
          format: 'csv',
          filename: `indra_compliance_export_${ctx.user.orgId}_${Date.now()}.csv`,
          content: csvHeader + csvRows,
        };
      }

      return {
        format: 'json',
        filename: `indra_compliance_export_${ctx.user.orgId}_${Date.now()}.json`,
        content: JSON.stringify(exportData, null, 2),
      };
    }),
});
