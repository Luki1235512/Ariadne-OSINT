import { QueryClient, skipToken, useQuery } from "@tanstack/react-query";
import { ApiError, fetchObjectDetails } from "./api";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          failureCount < 2 && !(error instanceof ApiError && error.status < 500),
      },
    },
  });
}

export function useObjectDetails(id: string | null) {
  return useQuery({
    queryKey: ["object", id],
    queryFn: id === null ? skipToken : ({ signal }) => fetchObjectDetails(id, signal),
  });
}
