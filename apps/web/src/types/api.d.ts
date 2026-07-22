/**
 * Ambient type declaration for @indra-ai/api.
 *
 * This prevents the web compiler from traversing the API source tree
 * and importing Express/Prisma types. The AppRouter type is declared
 * as an opaque type here; tRPC only needs the shape for inference.
 *
 * In CI/production, replace with the compiled dist types from the api package.
 */

// Re-export the router type shape from the compiled api output.
// During local dev, the vite dev server proxies all /api/trpc calls to the
// running Express server — no direct source import is needed at runtime.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppRouter = any;
