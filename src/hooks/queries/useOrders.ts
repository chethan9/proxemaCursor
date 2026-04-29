import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchOrders, type FetchOrdersOptions } from "@/services/orderService";
import { queryKeys } from "@/lib/query-client";
import { useStoreSyncStatus } from "./useStoreSyncStatus";

export function useOrders(opts: FetchOrdersOptions & { enabled?: boolean }) {
  const { enabled: enabledOverride, ...fetchOpts } = opts;
  const { data: syncStatus } = useStoreSyncStatus(fetchOpts.storeId);
  const initialSyncRunning = syncStatus ? !syncStatus.initialSyncDone : false;
  const anySyncRunning = syncStatus?.running || initialSyncRunning;
  return useQuery({
    queryKey: [...queryKeys.orders(fetchOpts.storeId, fetchOpts as unknown as Record<string, unknown>), initialSyncRunning ? "live" : "db"] as const,
    queryFn: async () => {
      if (initialSyncRunning) {
        try {
          return await fetchOrders({ ...fetchOpts, useLive: true });
        } catch (e) {
          console.warn("[useOrders] live fetch failed, falling back to DB:", e);
          return fetchOrders({ ...fetchOpts, useLive: false });
        }
      }
      return fetchOrders({ ...fetchOpts, useLive: false });
    },
    placeholderData: keepPreviousData,
    enabled: !!fetchOpts.storeId && syncStatus !== undefined && (enabledOverride ?? true),
    staleTime: anySyncRunning ? 10_000 : 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
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