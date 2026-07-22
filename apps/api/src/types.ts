/**
 * This file is the ONLY file the frontend imports from @indra-ai/api.
 * It exports exclusively the router TYPE — no Express runtime, no Prisma,
 * no server-side dependencies that would bleed into the frontend compiler.
 */
export type { AppRouter } from './router';
