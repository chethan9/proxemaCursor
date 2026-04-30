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
  return data as unknown as SiteStatsResponse;
}