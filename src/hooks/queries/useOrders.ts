import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchOrders, type FetchOrdersOptions } from "@/services/orderService";
import { queryKeys } from "@/lib/query-client";
import { useStoreSyncStatus } from "./useStoreSyncStatus";

export function useOrders(opts: FetchOrdersOptions) {
  const { data: syncStatus } = useStoreSyncStatus(opts.storeId);
  const initialSyncRunning = syncStatus ? !syncStatus.initialSyncDone : false;
  return useQuery({
    queryKey: [...queryKeys.orders(opts.storeId, opts as unknown as Record<string, unknown>), initialSyncRunning ? "hybrid" : "db"] as const,
    queryFn: async () => {
      const dbRes = await fetchOrders({ ...opts, useLive: false });
      if (dbRes.data.length > 0 || !initialSyncRunning) return dbRes;
      try {
        const live = await fetchOrders({ ...opts, useLive: true });
        return live;
      } catch (e) {
        console.warn("[useOrders] live fetch failed:", e);
        return dbRes;
      }
    },
    placeholderData: keepPreviousData,
    enabled: !!opts.storeId && syncStatus !== undefined,
    refetchOnWindowFocus: true,
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