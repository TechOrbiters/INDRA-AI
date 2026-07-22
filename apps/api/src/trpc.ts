import { initTRPC, TRPCError } from '@trpc/server';
import type { AppContext, UserContext } from './context';

const t = initTRPC.context<AppContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// Middleware to ensure user is authenticated
const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({
    ctx: { user: ctx.user as UserContext },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// Helper to build custom RBAC authorization middleware
export const checkRole = (roles: Array<UserContext['role']>) => {
  return t.middleware(({ next, ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }
    if (!roles.includes(ctx.user.role as UserContext['role'])) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Role '${ctx.user.role}' is not authorized to perform this action.`,
      });
    }
    return next({
      ctx: { user: ctx.user as UserContext },
    });
  });
};
