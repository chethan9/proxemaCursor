import { subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import type { DateRangePresetValue } from "@/components/explore/DateRangeFilter";

export interface SiteHomeMeta {
  period_custom?: boolean;
  combine_all?: boolean;
  fx_fallback?: boolean;
  period_start?: string | null;
  period_end?: string | null;
}

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
  meta?: SiteHomeMeta;
}

export interface SiteHomeStatsQuery {
  range: DateRangePresetValue;
  /** Custom range start (calendar date in store TZ), ISO date string YYYY-MM-DD */
  fromYmd?: string | null;
  /** Custom range end */
  toYmd?: string | null;
  combineAll?: boolean;
}

/** Maps preset + optional custom YYYY-MM-DD bounds to RPC timestamptz args (ISO strings). */
export function siteHomeStatsRpcPeriod(
  query: SiteHomeStatsQuery,
  storeTimezone: string | null | undefined
): { p_period_start: string | null; p_period_end: string | null } {
  const tz = (storeTimezone && storeTimezone.trim()) || "UTC";

  if (query.range === "30d") {
    return { p_period_start: null, p_period_end: null };
  }

  const now = new Date();

  const boundsFromYmd = (startYmd: string, endYmd: string) => ({
    p_period_start: fromZonedTime(`${startYmd}T00:00:00`, tz).toISOString(),
    p_period_end: fromZonedTime(`${endYmd}T23:59:59.999`, tz).toISOString(),
  });

  if (query.range === "custom" && query.fromYmd && query.toYmd) {
    return boundsFromYmd(query.fromYmd, query.toYmd);
  }

  if (query.range === "all") {
    return {
      p_period_start: fromZonedTime("2000-01-01T00:00:00", tz).toISOString(),
      p_period_end: now.toISOString(),
    };
  }

  const todayYmd = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const noonAnchor = fromZonedTime(`${todayYmd}T12:00:00`, tz);

  if (query.range === "today") {
    return boundsFromYmd(todayYmd, todayYmd);
  }

  if (query.range === "yesterday") {
    const y = formatInTimeZone(subDays(noonAnchor, 1), tz, "yyyy-MM-dd");
    return boundsFromYmd(y, y);
  }

  if (query.range === "7d") {
    const startYmd = formatInTimeZone(subDays(noonAnchor, 6), tz, "yyyy-MM-dd");
    return boundsFromYmd(startYmd, todayYmd);
  }

  if (query.range === "90d") {
    const startYmd = formatInTimeZone(subDays(noonAnchor, 89), tz, "yyyy-MM-dd");
    return boundsFromYmd(startYmd, todayYmd);
  }

  return { p_period_start: null, p_period_end: null };
}

export async function fetchSiteHomeStats(
  storeId: string,
  currency: string | null | undefined,
  storeTimezone: string | null | undefined,
  homeQuery: SiteHomeStatsQuery
): Promise<SiteStatsResponse> {
  const browserTz =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  const effectiveTz = (storeTimezone && storeTimezone.trim()) || browserTz || "UTC";
  const { p_period_start, p_period_end } = siteHomeStatsRpcPeriod(homeQuery, storeTimezone);
  const combine = !!homeQuery.combineAll;

  const { data, error } = await supabase.rpc("get_site_home_stats", {
    p_store_id: storeId,
    p_tz: effectiveTz,
    p_currency: combine ? null : currency || null,
    p_period_start,
    p_period_end,
    p_combine_all: combine,
  });
  if (error) throw error;
  const raw = data as unknown as SiteStatsResponse & { snapshot_updated_at?: unknown };
  let snapshot_updated_at: string | null | undefined = raw.snapshot_updated_at as string | null | undefined;
  if (snapshot_updated_at != null && typeof snapshot_updated_at !== "string") {
    snapshot_updated_at = String(snapshot_updated_at);
  }
  return { ...raw, snapshot_updated_at };
}
