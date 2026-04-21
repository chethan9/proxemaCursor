import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchTags } from "@/services/taxonomyService";
import { useStoreSyncStatus } from "./useStoreSyncStatus";

export function useTaxonomyRows(
  storeId: string,
  mode: "categories" | "tags",
  search: string,
  page: number,
  pageSize: number
) {
  const { data: syncStatus } = useStoreSyncStatus(storeId);
  const initialSyncRunning = syncStatus ? !syncStatus.initialSyncDone : false;
  const fetcher = mode === "categories" ? fetchCategories : fetchTags;
  return useQuery({
    queryKey: ["taxonomy", mode, storeId, search, page, pageSize, initialSyncRunning ? "hybrid" : "db"] as const,
    queryFn: async () => {
      const dbRes = await fetcher(storeId, search, page, pageSize, false);
      if (dbRes.data.length > 0 || !initialSyncRunning) return dbRes;
      try {
        return await fetcher(storeId, search, page, pageSize, true);
      } catch (e) {
        console.warn(`[useTaxonomy:${mode}] live fetch failed:`, e);
        return dbRes;
      }
    },
    placeholderData: keepPreviousData,
    enabled: !!storeId && syncStatus !== undefined,
    refetchOnWindowFocus: true,
    retry: 1,
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