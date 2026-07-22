import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../services/database';

export const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const notifications = await db.notification.findMany({
      where: { orgId: ctx.user.orgId, userId: ctx.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return notifications;
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await db.notification.count({
      where: { orgId: ctx.user.orgId, userId: ctx.user.id, read: false },
    });
    return { count };
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db.notification.updateMany({
        where: { id: input.id, orgId: ctx.user.orgId },
        data: { read: true, readAt: new Date() },
      });
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db.notification.updateMany({
      where: { orgId: ctx.user.orgId, userId: ctx.user.id, read: false },
      data: { read: true, readAt: new Date() },
    });
    return { success: true };
  }),

  create: protectedProcedure
    .input(z.object({
      userId: z.string(),
      type: z.string(),
      title: z.string(),
      body: z.string(),
      resourceType: z.string().optional(),
      resourceId: z.string().optional(),
      resourceUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const notifId = `notif_${Math.random().toString(36).substring(2, 11)}`;
      const notification = await db.notification.create({
        data: {
          id: notifId,
          orgId: ctx.user.orgId,
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          resourceUrl: input.resourceUrl,
          read: false,
        },
      });
      return notification;
    }),
});
