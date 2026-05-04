import { useMemo } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchProducts, type FetchProductsOptions, type ProductRow } from "@/services/productService";
import { fetchAllBrands, fetchAllCategories, fetchAllTags } from "@/services/taxonomyService";
import { listTaxonomy } from "@/services/wooTaxonomyService";
import { queryKeys } from "@/lib/query-client";
import { useStoreSyncStatus } from "./useStoreSyncStatus";

export type UseProductsOptions = Omit<FetchProductsOptions, "page"> & {
  enabled?: boolean;
  /** Batch size per fetched chunk. Default 100. */
  pageSize?: number;
};

/**
 * Infinite-scroll hook for the products list.
 *
 * Same shape as `useOrders` — returns a flat `data` array, `count` (total),
 * `fetchNextPage`, `hasNextPage`, etc. Filters live in `queryKey`, so any
 * change resets the list to the first chunk automatically.
 */
export function useProducts(opts: UseProductsOptions) {
  const { enabled: enabledOverride, pageSize = 100, ...fetchOpts } = opts;
  const { data: syncStatus } = useStoreSyncStatus(fetchOpts.storeId);
  const initialSyncRunning = syncStatus ? !syncStatus.initialSyncDone : false;
  const anySyncRunning = syncStatus?.running || initialSyncRunning;

  const query = useInfiniteQuery({
    queryKey: [
      ...queryKeys.products(fetchOpts.storeId, { ...fetchOpts, pageSize } as unknown as Record<string, unknown>),
      initialSyncRunning ? "live" : "db",
      "infinite",
    ] as const,
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
      if (initialSyncRunning) {
        try {
          return await fetchProducts({ ...fetchOpts, pageSize, page: pageParam, useLive: true });
        } catch (e) {
          console.warn("[useProducts] live fetch failed, falling back to DB:", e);
          return fetchProducts({ ...fetchOpts, pageSize, page: pageParam, useLive: false });
        }
      }
      return fetchProducts({ ...fetchOpts, pageSize, page: pageParam, useLive: false });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.data.length, 0);
      const total = lastPage.count ?? 0;
      if (lastPage.data.length === 0) return undefined;
      if (loaded >= total) return undefined;
      return allPages.length;
    },
    placeholderData: keepPreviousData,
    enabled: !!fetchOpts.storeId && syncStatus !== undefined && (enabledOverride ?? true),
    staleTime: anySyncRunning ? 10_000 : 120_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: anySyncRunning,
    refetchInterval: anySyncRunning ? 8_000 : false,
    retry: 1,
  });

  const data = useMemo<ProductRow[]>(() => {
    if (!query.data) return [];
    const out: ProductRow[] = [];
    for (const p of query.data.pages) {
      for (const r of p.data) out.push(r);
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
    isPlaceholderData: query.isPlaceholderData,
    refetch: query.refetch,
    error: query.error,
  };
}

export function useProductCategoryOptions(storeId: string) {
  return useQuery({
    queryKey: queryKeys.productCategoryOptions(storeId),
    queryFn: async () => {
      const [rows, live] = await Promise.all([
        fetchAllCategories(storeId).catch(() => []),
        listTaxonomy(storeId, "categories").catch(() => []),
      ]);
      const byWoo = new Map<number, { woo_id: number; name: string }>();
      for (const r of rows) {
        if (!r.name?.trim()) continue;
        byWoo.set(r.woo_id, { woo_id: r.woo_id, name: r.name });
      }
      for (const r of live) {
        if (!r.name?.trim()) continue;
        if (!byWoo.has(r.id)) byWoo.set(r.id, { woo_id: r.id, name: r.name });
      }
      return [...byWoo.values()].sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!storeId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useProductTagOptions(storeId: string) {
  return useQuery({
    queryKey: queryKeys.taxonomy(storeId, "tags"),
    queryFn: async () => {
      const rows = await fetchAllTags(storeId);
      return rows
        .filter((r) => r.name?.trim())
        .map((r) => ({ woo_id: r.woo_id, name: r.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!storeId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}

export function useProductBrandOptions(storeId: string) {
  return useQuery({
    queryKey: queryKeys.taxonomy(storeId, "brands"),
    queryFn: async () => {
      const rows = await fetchAllBrands(storeId);
      return rows
        .filter((r) => r.name?.trim())
        .map((r) => ({ woo_id: r.woo_id, name: r.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!storeId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}
