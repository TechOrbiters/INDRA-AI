/**
 * tRPC vanilla proxy client (no React generic needed at setup).
 * Queries are called via the useQuery/useMutation from @tanstack/react-query
 * directly, with the typed client for data fetching in page components.
 */
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';

function getToken() {
  return localStorage.getItem('indra_token') ?? localStorage.getItem('indra_ai_token') ?? '';
}

const API_URL =
  (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ??
  'http://localhost:3000';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpcClient = createTRPCProxyClient<any>({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      headers() {
        const token = getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
