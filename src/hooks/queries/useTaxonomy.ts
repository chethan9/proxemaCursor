import { useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchTags, fetchBrands, fetchAllCategories, type TaxonomySortField, type TaxonomySortDirection } from "@/services/taxonomyService";
import { queryKeys } from "@/lib/query-client";
import { useStoreSyncStatus } from "./useStoreSyncStatus";

export function useTaxonomyRows(
  storeId: string,
  mode: "categories" | "tags" | "brands",
  search: string,
  page: number,
  pageSize: number,
  sortField: TaxonomySortField = "name",
  sortDirection: TaxonomySortDirection = "asc",
) {
  const { data: syncStatus } = useStoreSyncStatus(storeId);
  const anySyncRunning = syncStatus?.running || (syncStatus ? !syncStatus.initialSyncDone : false);
  return useQuery({
    queryKey: ["taxonomy", mode, storeId, "rows", search, page, pageSize, sortField, sortDirection] as const,
    queryFn: () => {
      if (mode === "categories") return fetchCategories(storeId, search, page, pageSize, sortField, sortDirection);
      if (mode === "tags") return fetchTags(storeId, search, page, pageSize, sortField, sortDirection);
      return fetchBrands(storeId, search, page, pageSize, sortField, sortDirection);
    },
    enabled: !!storeId,
    staleTime: 60_000,
    refetchInterval: anySyncRunning ? 5000 : false,
  });
}

export function useAllCategories(storeId: string, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.taxonomy(storeId, "categories"), "all"] as const,
    queryFn: () => fetchAllCategories(storeId),
    enabled: !!storeId && enabled,
    staleTime: 60_000,
  });
}