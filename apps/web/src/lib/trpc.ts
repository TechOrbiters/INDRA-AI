/// <reference types="vite/client" />
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@indra-ai/api';

/**
 * tRPC React client instance — type-safe access to all API procedures.
 * Matches the API's AppRouter exported from apps/api/src/router.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc = createTRPCReact<AppRouter>() as any;

const API_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
  'http://localhost:3000';

/**
 * Create a fully-configured tRPC client.
 * Reads the auth token from localStorage and sends it as a Bearer header.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createTRPCClient(): any {
  return (trpc as ReturnType<typeof createTRPCReact<AppRouter>>).createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/api/trpc`,
        headers() {
          const token = localStorage.getItem('indra_token');
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    ],
  });
}
