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
  const useLive = syncStatus ? !syncStatus.initialSyncDone : false;
  return useQuery({
    queryKey: ["taxonomy", mode, storeId, search, page, pageSize, useLive] as const,
    queryFn: () =>
      mode === "categories"
        ? fetchCategories(storeId, search, page, pageSize, useLive)
        : fetchTags(storeId, search, page, pageSize, useLive),
    placeholderData: keepPreviousData,
    enabled: !!storeId && syncStatus !== undefined,
    refetchOnWindowFocus: true,
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