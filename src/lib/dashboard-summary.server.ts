import { supabaseAdmin } from "@/integrations/supabase/admin";

/** Fire-and-forget refresh of precomputed dashboard rows for a store (service role). */
export function scheduleDashboardSummaryRefresh(storeId: string): void {
  void supabaseAdmin.rpc("refresh_dashboard_summaries_for_store", { p_store_id: storeId }).then(({ error }) => {
    if (error) console.warn("[dashboard-summary] refresh failed:", storeId, error.message);
  });
}
