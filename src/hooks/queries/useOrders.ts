import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchOrders, type FetchOrdersOptions } from "@/services/orderService";
import { queryKeys } from "@/lib/query-client";

export function useOrders(opts: FetchOrdersOptions) {
  return useQuery({
    queryKey: queryKeys.orders(opts.storeId, opts as unknown as Record<string, unknown>),
    queryFn: () => fetchOrders(opts),
    placeholderData: keepPreviousData,
    enabled: !!opts.storeId,
    refetchOnWindowFocus: true,
  });
}

export function useOrderPaymentOptions(storeId: string) {
  return useQuery({
    queryKey: queryKeys.orderPaymentOptions(storeId),
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("payment_method")
        .eq("store_id", storeId)
        .limit(500);
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