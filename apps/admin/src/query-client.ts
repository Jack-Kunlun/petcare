import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { showApiError } from "./lib/global-error";

/** Creates the Admin QueryClient with retries and final-failure error reporting. */
export function createAdminQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: (error) => showApiError(error) }),
    mutationCache: new MutationCache({ onError: (error) => showApiError(error) }),
    defaultOptions: {
      queries: { retry: 2, refetchOnWindowFocus: false },
    },
  });
}
