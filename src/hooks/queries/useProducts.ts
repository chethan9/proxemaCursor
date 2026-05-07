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

type TaxonomyOptionRow = { woo_id: number | null; name: string | null };

/** Merge DB taxonomy rows with live Woo terms so IDs assigned on products but missing locally still appear in dropdowns. */
function mergeTaxonomyOptionsForExplorer(
  rows: TaxonomyOptionRow[],
  live: { id: number; name?: string }[],
): { woo_id: number; name: string }[] {
  const liveById = new Map(live.map((t) => [t.id, t] as const));
  const byId = new Map<number, string>();

  for (const r of rows) {
    if (r.woo_id == null) continue;
    const lv = liveById.get(r.woo_id);
    const name = (lv?.name?.trim() || r.name?.trim() || "").trim();
    if (!name) continue;
    byId.set(r.woo_id, name);
  }

  for (const t of live) {
    const name = (typeof t.name === "string" ? t.name : "").trim();
    if (!name) continue;
    if (!byId.has(t.id)) {
      byId.set(t.id, name);
    }
  }

  return Array.from(byId.entries())
    .map(([woo_id, name]) => ({ woo_id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

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
  const awaitingSyncStatus = syncStatus === undefined;
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
    enabled: !!fetchOpts.storeId && !awaitingSyncStatus && (enabledOverride ?? true),
    staleTime: anySyncRunning ? 10_000 : 120_000,
    gcTime: 10 * 60_000,
    /** Refetch stale data when revisiting the catalog (needed after mutations invalidated the list while the route was inactive). */
    refetchOnMount: true,
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
    /** Includes waiting on store sync-status so the UI does not flash an empty catalog first. */
    isLoading: awaitingSyncStatus || query.isLoading,
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
      return mergeTaxonomyOptionsForExplorer(rows, live);
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
      const [rows, live] = await Promise.all([
        fetchAllTags(storeId).catch(() => []),
        listTaxonomy(storeId, "tags").catch(() => []),
      ]);
      return mergeTaxonomyOptionsForExplorer(rows, live);
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
      const [rows, live] = await Promise.all([
        fetchAllBrands(storeId).catch(() => []),
        listTaxonomy(storeId, "brands").catch(() => []),
      ]);
      return mergeTaxonomyOptionsForExplorer(rows, live);
    },
    enabled: !!storeId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}
