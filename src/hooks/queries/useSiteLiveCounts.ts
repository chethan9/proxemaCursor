import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SiteLiveCounts {
  products: number;
  orders: number;
  customers: number;
  categories: number;
  tags: number;
  coupons: number;
}

async function fetchSiteLiveCounts(storeId: string): Promise<SiteLiveCounts> {
  const [p, o, c, cat, tg, cp] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("categories").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("tags").select("id", { count: "exact", head: true }).eq("store_id", storeId),
    supabase.from("coupons").select("id", { count: "exact", head: true }).eq("store_id", storeId),
  ]);
  return {
    products: p.count || 0,
    orders: o.count || 0,
    customers: c.count || 0,
    categories: cat.count || 0,
    tags: tg.count || 0,
    coupons: cp.count || 0,
  };
}

export function useSiteLiveCounts(storeId: string | undefined, opts?: { isSyncing?: boolean }) {
  return useQuery({
    queryKey: ["site-live-counts", storeId],
    queryFn: () => fetchSiteLiveCounts(storeId!),
    enabled: !!storeId,
    refetchInterval: opts?.isSyncing ? 10_000 : 30_000,
    staleTime: 5_000,
  });
}