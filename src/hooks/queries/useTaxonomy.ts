import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchTags } from "@/services/taxonomyService";

export function useTaxonomyRows(
  storeId: string,
  mode: "categories" | "tags",
  search: string,
  page: number,
  pageSize: number
) {
  return useQuery({
    queryKey: ["taxonomy", mode, storeId, search, page, pageSize] as const,
    queryFn: () => (mode === "categories" ? fetchCategories(storeId, search, page, pageSize) : fetchTags(storeId, search, page, pageSize)),
    placeholderData: keepPreviousData,
    enabled: !!storeId,
  });
}

export function useAllCategories(storeId: string, enabled = true) {
  return useQuery({
    queryKey: ["taxonomy", "categories", "all", storeId] as const,
    queryFn: async () => {
      const { data } = await fetchCategories(storeId, "", 0, 500);
      return data;
    },
    enabled: enabled && !!storeId,
    staleTime: 5 * 60_000,
  });
}