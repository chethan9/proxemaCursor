import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchProducts, type FetchProductsOptions } from "@/services/productService";
import { fetchAllCategories } from "@/services/taxonomyService";
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
      const names = rows.map((r) => r.name).filter((n): n is string => !!n?.trim());
      return [...new Set(names)].sort((a, b) => a.localeCompare(b));
    },
    enabled: !!storeId,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}