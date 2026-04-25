import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchOrders, type FetchOrdersOptions } from "@/services/orderService";
import { queryKeys } from "@/lib/query-client";
import { useStoreSyncStatus } from "./useStoreSyncStatus";

export function useOrders(opts: FetchOrdersOptions) {
  const { data: syncStatus } = useStoreSyncStatus(opts.storeId);
  const initialSyncRunning = syncStatus ? !syncStatus.initialSyncDone : false;
  const anySyncRunning = syncStatus?.running || initialSyncRunning;
  return useQuery({
    queryKey: [...queryKeys.orders(opts.storeId, opts as unknown as Record<string, unknown>), initialSyncRunning ? "live" : "db"] as const,
    queryFn: async () => {
      if (initialSyncRunning) {
        try {
          return await fetchOrders({ ...opts, useLive: true });
        } catch (e) {
          console.warn("[useOrders] live fetch failed, falling back to DB:", e);
          return fetchOrders({ ...opts, useLive: false });
        }
      }
      return fetchOrders({ ...opts, useLive: false });
    },
    placeholderData: keepPreviousData,
    enabled: !!opts.storeId && syncStatus !== undefined,
    refetchOnWindowFocus: true,
    refetchInterval: anySyncRunning ? 8000 : false,
    retry: 1,
  });
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