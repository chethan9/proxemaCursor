import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  fetchCategories,
  fetchTags,
  fetchBrands,
  fetchAllCategories,
  type TaxonomySortField,
  type TaxonomySortDirection,
} from "@/services/taxonomyService";
import { queryKeys } from "@/lib/query-client";
import { useStoreSyncStatus } from "./useStoreSyncStatus";
import type { Database } from "@/integrations/supabase/helpers";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type TagRow = Database["public"]["Tables"]["tags"]["Row"];
type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type TaxonomyRow = CategoryRow | TagRow | BrandRow;

/**
 * Infinite-scroll taxonomy list (categories, tags, or brands).
 */
export function useTaxonomyRows(
  storeId: string,
  mode: "categories" | "tags" | "brands",
  search: string,
  pageSize: number,
  sortField: TaxonomySortField = "name",
  sortDirection: TaxonomySortDirection = "asc",
) {
  const { data: syncStatus } = useStoreSyncStatus(storeId);
  const anySyncRunning = syncStatus?.running || (syncStatus ? !syncStatus.initialSyncDone : false);

  const query = useInfiniteQuery({
    queryKey: ["taxonomy", mode, storeId, "infinite", search, pageSize, sortField, sortDirection] as const,
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
      if (mode === "categories") return fetchCategories(storeId, search, pageParam, pageSize, sortField, sortDirection);
      if (mode === "tags") return fetchTags(storeId, search, pageParam, pageSize, sortField, sortDirection);
      return fetchBrands(storeId, search, pageParam, pageSize, sortField, sortDirection);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.data.length, 0);
      const total = lastPage.count ?? 0;
      if (lastPage.data.length === 0) return undefined;
      if (loaded >= total) return undefined;
      return allPages.length;
    },
    enabled: !!storeId,
    staleTime: 60_000,
    refetchInterval: anySyncRunning ? 5000 : false,
  });

  const data = useMemo<TaxonomyRow[]>(() => {
    if (!query.data) return [];
    const out: TaxonomyRow[] = [];
    for (const p of query.data.pages) {
      for (const r of p.data) out.push(r as TaxonomyRow);
    }
    return out;
  }, [query.data]);

  const count = query.data?.pages[0]?.count ?? 0;

  return {
    data,
    count,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    error: query.error,
  };
}

export function useAllCategories(storeId: string, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.taxonomy(storeId, "categories"), "all"] as const,
    queryFn: () => fetchAllCategories(storeId),
    enabled: !!storeId && enabled,
    staleTime: 60_000,
  });
}
