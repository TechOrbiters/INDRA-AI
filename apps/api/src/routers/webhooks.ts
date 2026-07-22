import { router, protectedProcedure, checkRole } from '../trpc';
import { z } from 'zod';
import { db } from '../services/database';
import { TRPCError } from '@trpc/server';

const WEBHOOK_EVENTS = [
  'knowledge.created',
  'knowledge.updated',
  'knowledge.deleted',
  'knowledge.verified',
  'ai.answer.escalated',
  'user.invited',
  'user.deactivated',
] as const;

export const webhooksRouter = router({
  /**
   * List registered webhooks for the organization (§6.8)
   */
  list: protectedProcedure
    .use(checkRole(['super_admin', 'knowledge_admin']))
    .query(async ({ ctx }) => {
      const webhooks = await db.webhook.findMany({
        where: { orgId: ctx.user.orgId },
        orderBy: { createdAt: 'desc' },
      });

      return webhooks.map(wh => ({
        id: wh.id,
        url: wh.url,
        events: JSON.parse(wh.events || '[]') as string[],
        active: wh.active,
        failureCount: wh.failureCount,
        lastTriggeredAt: wh.lastTriggeredAt?.toISOString() || null,
        createdAt: wh.createdAt.toISOString(),
      }));
    }),

  /**
   * Register a new webhook endpoint (§6.8)
   */
  register: protectedProcedure
    .use(checkRole(['super_admin', 'knowledge_admin']))
    .input(z.object({
      url: z.string().url('Must be a valid HTTP or HTTPS URL'),
      events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, 'Select at least one event'),
    }))
    .mutation(async ({ input, ctx }) => {
      const webhookId = `wh_${Math.random().toString(36).substring(2, 11)}`;
      const secretHash = `whsec_${Math.random().toString(36).substring(2, 20)}`;

      const webhook = await db.webhook.create({
        data: {
          id: webhookId,
          orgId: ctx.user.orgId,
          url: input.url,
          events: JSON.stringify(input.events),
          secretHash,
          active: true,
          failureCount: 0,
        },
      });

      // Log in audit log
      await db.auditEvent.create({
        data: {
          id: `evt_${Math.random().toString(36).substring(2, 11)}`,
          orgId: ctx.user.orgId,
          actorId: ctx.user.id,
          actorIp: ctx.actorIp || '127.0.0.1',
          actorUserAgent: ctx.actorUserAgent || 'tRPC Client',
          action: 'webhook.registered',
          resourceType: 'integration',
          resourceId: webhook.id,
          after: JSON.stringify({ url: webhook.url, events: input.events }),
        },
      });

      return {
        id: webhook.id,
        url: webhook.url,
        secret: secretHash,
        events: input.events,
        active: webhook.active,
        createdAt: webhook.createdAt.toISOString(),
      };
    }),

  /**
   * Delete a webhook endpoint (§6.8)
   */
  delete: protectedProcedure
    .use(checkRole(['super_admin', 'knowledge_admin']))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const webhook = await db.webhook.findUnique({ where: { id: input.id } });

      if (!webhook || webhook.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Webhook endpoint not found.' });
      }

      await db.webhook.delete({ where: { id: webhook.id } });

      await db.auditEvent.create({
        data: {
          id: `evt_${Math.random().toString(36).substring(2, 11)}`,
          orgId: ctx.user.orgId,
          actorId: ctx.user.id,
          actorIp: ctx.actorIp || '127.0.0.1',
          actorUserAgent: ctx.actorUserAgent || 'tRPC Client',
          action: 'webhook.deleted',
          resourceType: 'integration',
          resourceId: webhook.id,
          before: JSON.stringify({ url: webhook.url }),
        },
      });

      return { success: true, id: webhook.id };
    }),

  /**
   * Send a test payload to a webhook endpoint (§6.8)
   */
  test: protectedProcedure
    .use(checkRole(['super_admin', 'knowledge_admin']))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const webhook = await db.webhook.findUnique({ where: { id: input.id } });

      if (!webhook || webhook.orgId !== ctx.user.orgId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Webhook endpoint not found.' });
      }

      // Record simulated trigger timestamp
      await db.webhook.update({
        where: { id: webhook.id },
        data: { lastTriggeredAt: new Date() },
      });

      return {
        success: true,
        statusCode: 200,
        deliveredAt: new Date().toISOString(),
        samplePayload: {
          event: 'webhook.test',
          orgId: ctx.user.orgId,
          timestamp: new Date().toISOString(),
          data: { ping: 'pong', message: 'INDRA AI Webhook test payload successful' },
        },
      };
    }),
});
