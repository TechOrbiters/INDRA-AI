import { router } from './trpc';
import { authRouter } from './routers/auth';
import { searchRouter } from './routers/search';
import { knowledgeRouter } from './routers/knowledge';
import { adminRouter } from './routers/admin';
import { graphRouter } from './routers/graph';
import { auditRouter } from './routers/audit';
import { notificationsRouter } from './routers/notifications';
import { aiRouter } from './routers/ai';
import { expertsRouter } from './routers/experts';
import { healthRouter } from './routers/health';
import { webhooksRouter } from './routers/webhooks';
import { meetingsRouter } from './routers/meetings';

export const appRouter = router({
  auth: authRouter,
  search: searchRouter,
  knowledge: knowledgeRouter,
  admin: adminRouter,
  graph: graphRouter,
  audit: auditRouter,
  notifications: notificationsRouter,
  ai: aiRouter,
  experts: expertsRouter,
  health: healthRouter,
  webhooks: webhooksRouter,
  meetings: meetingsRouter,
});

export type AppRouter = typeof appRouter;
