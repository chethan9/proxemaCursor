import { useMemo } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchOrders, type FetchOrdersOptions, type OrderRow } from "@/services/orderService";
import { queryKeys } from "@/lib/query-client";
import { useStoreSyncStatus } from "./useStoreSyncStatus";

export type UseOrdersOptions = Omit<FetchOrdersOptions, "page"> & {
  enabled?: boolean;
  /** Batch size per fetched chunk. Default 100. */
  pageSize?: number;
};

/**
 * Infinite-scroll hook for the orders list.
 *
 * Returns a flat `data` array spanning every loaded chunk plus helpers to load
 * the next chunk on demand. Filters / sort live in `queryKey` so changing them
 * resets the list automatically (first chunk re-fetched).
 */
export function useOrders(opts: UseOrdersOptions) {
  const { enabled: enabledOverride, pageSize = 100, ...fetchOpts } = opts;
  const { data: syncStatus } = useStoreSyncStatus(fetchOpts.storeId);
  const initialSyncRunning = syncStatus ? !syncStatus.initialSyncDone : false;
  const anySyncRunning = syncStatus?.running || initialSyncRunning;

  const query = useInfiniteQuery({
    queryKey: [
      ...queryKeys.orders(fetchOpts.storeId, { ...fetchOpts, pageSize } as unknown as Record<string, unknown>),
      initialSyncRunning ? "live" : "db",
      "infinite",
    ] as const,
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
      if (initialSyncRunning) {
        try {
          return await fetchOrders({ ...fetchOpts, pageSize, page: pageParam, useLive: true });
        } catch (e) {
          console.warn("[useOrders] live fetch failed, falling back to DB:", e);
          return fetchOrders({ ...fetchOpts, pageSize, page: pageParam, useLive: false });
        }
      }
      return fetchOrders({ ...fetchOpts, pageSize, page: pageParam, useLive: false });
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
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: anySyncRunning ? 25_000 : false,
    retry: 1,
  });

  const data = useMemo<OrderRow[]>(() => {
    if (!query.data) return [];
    const out: OrderRow[] = [];
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

export function useOrderPaymentOptions(storeId: string) {
  return useQuery({
    queryKey: queryKeys.orderPaymentOptions(storeId),
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("payment_method").eq("store_id", storeId).limit(500);
      const set = new Set<string>();
      (data || []).forEach((r: { payment_method: string | null }) => {
        if (r.payment_method) set.add(r.payment_method);
      });
      return Array.from(set).sort();
    },
    enabled: !!storeId,
    staleTime: 5 * 60_000,
  });
}
