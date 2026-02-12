import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale after 30 seconds
      staleTime: 30 * 1000,
      // Retry failed requests up to 2 times
      retry: 2,
      // Refetch on window focus (useful when returning to app)
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
