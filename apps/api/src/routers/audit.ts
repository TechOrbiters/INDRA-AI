import { router, protectedProcedure, checkRole } from '../trpc';
import { db } from '../services/database';

export const auditRouter = router({
  listEvents: protectedProcedure
    .use(checkRole(['super_admin', 'knowledge_admin']))
    .query(async ({ ctx }) => {
      // F-006 Audit Log logs list
      const logs = await db.auditEvent.findMany({
        where: { orgId: ctx.user.orgId },
        orderBy: { createdAt: 'desc' },
      });

      return logs.map((log) => ({
        ...log,
        before: log.before ? JSON.parse(log.before) : null,
        after: log.after ? JSON.parse(log.after) : null,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      }));
    }),
});
