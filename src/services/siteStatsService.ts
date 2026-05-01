import { supabase } from "@/integrations/supabase/client";

export interface SiteStatsResponse {
  stats: {
    orders_today: number;
    orders_in_progress: number;
    sales_today: number;
    sales_week: number;
    sales_month: number;
    orders_month_count: number;
    sales_prev_month: number;
    orders_total: number;
  };
  daily: { day: string; orders: number; revenue: number }[];
  status_breakdown: { status: string; count: number }[];
  recent_orders: {
    id: string;
    woo_id: number | null;
    order_number: string | null;
    status: string | null;
    total: string | null;
    currency: string | null;
    date_created: string | null;
    line_items: unknown;
    billing: unknown;
  }[];
  top_products: {
    product_id: number;
    name: string | null;
    units: number;
    revenue: number;
    image: string | null;
    local_id: string | null;
  }[];
  currencies: { code: string; count: number }[];
  currency: string;
  /** Present when served from dashboard_summary cache or immediately after recompute */
  snapshot_updated_at?: string | null;
}

export async function fetchSiteHomeStats(
  storeId: string,
  currency?: string | null,
  storeTimezone?: string | null
): Promise<SiteStatsResponse> {
  const browserTz =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const effectiveTz = (storeTimezone && storeTimezone.trim()) || browserTz || "UTC";
  const { data, error } = await supabase.rpc("get_site_home_stats", {
    p_store_id: storeId,
    p_tz: effectiveTz,
    p_currency: currency || null,
  });
  if (error) throw error;
  const raw = data as unknown as SiteStatsResponse & { snapshot_updated_at?: unknown };
  let snapshot_updated_at: string | null | undefined = raw.snapshot_updated_at as string | null | undefined;
  if (snapshot_updated_at != null && typeof snapshot_updated_at !== "string") {
    snapshot_updated_at = String(snapshot_updated_at);
  }
  return { ...raw, snapshot_updated_at };
}