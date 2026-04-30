import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchProducts, type FetchProductsOptions } from "@/services/productService";
import { fetchAllBrands, fetchAllCategories, fetchAllTags } from "@/services/taxonomyService";
import { queryKeys } from "@/lib/query-client";
import { useStoreSyncStatus } from "./useStoreSyncStatus";

export function useProducts(opts: FetchProductsOptions & { enabled?: boolean }) {
  const { enabled: enabledOverride, ...fetchOpts } = opts;
  const { data: syncStatus } = useStoreSyncStatus(fetchOpts.storeId);
  const initialSyncRunning = syncStatus ? !syncStatus.initialSyncDone : false;
  const anySyncRunning = syncStatus?.running || initialSyncRunning;
  return useQuery({
    queryKey: [...queryKeys.products(fetchOpts.storeId, fetchOpts as unknown as Record<string, unknown>), initialSyncRunning ? "live" : "db"] as const,
    queryFn: async () => {
      if (initialSyncRunning) {
        try {
          return await fetchProducts({ ...fetchOpts, useLive: true });
        } catch (e) {
          console.warn("[useProducts] live fetch failed, falling back to DB:", e);
          return fetchProducts({ ...fetchOpts, useLive: false });
        }
      }
      return fetchProducts({ ...fetchOpts, useLive: false });
    },
    placeholderData: keepPreviousData,
    enabled: !!fetchOpts.storeId && syncStatus !== undefined && (enabledOverride ?? true),
    staleTime: anySyncRunning ? 10_000 : 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: anySyncRunning,
    refetchInterval: anySyncRunning ? 8000 : false,
    retry: 1,
  });
}

export function useProductCategoryOptions(storeId: string) {
  return useQuery({
    queryKey: queryKeys.productCategoryOptions(storeId),
    queryFn: async () => {
      const rows = await fetchAllCategories(storeId);
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