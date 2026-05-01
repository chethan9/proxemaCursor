import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SAMPLE_LIMIT = 8000;

/**
 * Distinct `orders.status` values observed for this store (sample-based).
 * Used for custom WooCommerce order-status tabs and bulk/quick-edit options.
 */
export function useOrderDistinctStatuses(storeId: string | undefined) {
  return useQuery({
    queryKey: ["order-distinct-statuses", storeId],
    queryFn: async () => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("status")
        .eq("store_id", storeId)
        .not("status", "is", null)
        .limit(SAMPLE_LIMIT);
      if (error) throw error;
      const set = new Set<string>();
      for (const r of data ?? []) {
        const s = r.status;
        if (typeof s === "string") {
          const t = s.trim();
          if (t) set.add(t);
        }
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },
    enabled: !!storeId,
    staleTime: 5 * 60_000,
  });
}
