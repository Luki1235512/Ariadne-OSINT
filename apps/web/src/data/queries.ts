import { keepPreviousData, QueryClient, skipToken, useQuery } from "@tanstack/react-query";
import { ApiError, fetchObjectDetails, fetchSearch } from "./api";

export const MIN_SEARCH_LENGTH = 3;

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

export function useSearch(query: string) {
  const text = query.trim();
  return useQuery({
    queryKey: ["search", text],
    queryFn:
      text.length < MIN_SEARCH_LENGTH ? skipToken : ({ signal }) => fetchSearch(text, signal),
    placeholderData: keepPreviousData,
  });
}
