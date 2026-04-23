import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, type FetchProductsOptions } from "@/services/productService";
import { queryKeys } from "@/lib/query-client";
import { useStoreSyncStatus } from "./useStoreSyncStatus";

export function useProducts(opts: FetchProductsOptions) {
  const { data: syncStatus } = useStoreSyncStatus(opts.storeId);
  const initialSyncRunning = syncStatus ? !syncStatus.initialSyncDone : false;
  const anySyncRunning = syncStatus?.running || initialSyncRunning;
  return useQuery({
    queryKey: [...queryKeys.products(opts.storeId, opts as unknown as Record<string, unknown>), initialSyncRunning ? "hybrid" : "db"] as const,
    queryFn: async () => {
      const dbRes = await fetchProducts({ ...opts, useLive: false });
      if (dbRes.data.length > 0 || !initialSyncRunning) return dbRes;
      try {
        const live = await fetchProducts({ ...opts, useLive: true });
        return live;
      } catch (e) {
        console.warn("[useProducts] live fetch failed:", e);
        return dbRes;
      }
    },
    placeholderData: keepPreviousData,
    enabled: !!opts.storeId && syncStatus !== undefined,
    refetchOnWindowFocus: true,
    refetchInterval: anySyncRunning ? 5000 : false,
    retry: 1,
  });
}

export function useProductCategoryOptions(storeId: string) {
  return useQuery({
    queryKey: queryKeys.productCategoryOptions(storeId),
    queryFn: async () => {
      const { data } = await supabase.from("products").select("categories").eq("store_id", storeId).limit(500);
      const set = new Set<string>();
      (data || []).forEach((r: { categories: unknown }) => {
        if (Array.isArray(r.categories)) {
          r.categories.forEach((c: unknown) => {
            const obj = c as { name?: string };
            if (obj?.name) set.add(obj.name);
          });
        }
      });
      return Array.from(set).sort();
    },
    enabled: !!storeId,
    staleTime: 5 * 60_000,
  });
}