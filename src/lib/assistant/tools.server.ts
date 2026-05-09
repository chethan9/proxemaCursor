import type { DateRangePresetValue } from "@/components/explore/DateRangeFilter";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getProductThumbnailWithMirrors } from "@/lib/product-image-urls";
import type { SiteHomeStatsQuery, SiteStatsResponse } from "@/services/siteStatsService";
import { siteHomeStatsRpcPeriod } from "@/services/siteStatsService";

/** Intl formatting for assistant tool payloads — avoids the model inventing $ for non-USD stores. */
export function formatAssistantMoney(amount: number, currencyCode: string): string {
  const code = (currencyCode || "USD").trim().toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

function buildAssistantPeriodContext(
  opts: AssistantToolRangeOpts,
  bundle: { tz: string; currency: string | null },
): string {
  const range = opts.range ?? "30d";
  const reporting = (bundle.currency?.trim() || "USD").toUpperCase();
  const parts = [
    `Reporting currency (ISO 4217): ${reporting}. Monetary amounts in this result set use this currency.`,
    `Store timezone for rolling windows and calendar cutoffs: ${bundle.tz}.`,
    `Range preset: "${range}".`,
  ];
  if (opts.combineAll) {
    parts.push("combine_all=true: multi-currency orders are converted into reporting currency via FX.");
  }
  if (range === "custom" && opts.fromYmd && opts.toYmd) {
    parts.push(`Custom inclusive calendar dates in store TZ: ${opts.fromYmd} through ${opts.toYmd}.`);
  } else {
    parts.push(
      "Date boundaries follow the same rules as the site dashboard home stats (rolling windows anchored in the store timezone).",
    );
  }
  return parts.join(" ");
}

/** Store prefs for system prompt + consistent defaults */
export async function getAssistantStorePrefsForPrompt(
  storeId: string,
): Promise<{ timezone: string; currency: string }> {
  const row = await loadStoreRow(storeId);
  return {
    timezone: row?.timezone?.trim() || "UTC",
    currency: (row?.currency?.trim() || "USD").toUpperCase(),
  };
}

function escapeIlikePattern(raw: string): string {
  return raw.trim().replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function loadStoreRow(storeId: string) {
  const { data, error } = await supabaseAdmin
    .from("stores")
    .select("timezone, currency")
    .eq("id", storeId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type AssistantToolRangeOpts = {
  range?: DateRangePresetValue;
  fromYmd?: string | null;
  toYmd?: string | null;
  combineAll?: boolean;
};

function buildSiteHomeQuery(opts: AssistantToolRangeOpts): SiteHomeStatsQuery {
  const range = opts.range ?? "30d";
  if (range === "custom" && opts.fromYmd && opts.toYmd) {
    return {
      range: "custom",
      fromYmd: opts.fromYmd,
      toYmd: opts.toYmd,
      combineAll: opts.combineAll,
    };
  }
  if (range === "custom") {
    return { range: "30d", combineAll: opts.combineAll };
  }
  return { range, combineAll: opts.combineAll };
}

async function rpcPeriodBundle(storeId: string, opts: AssistantToolRangeOpts) {
  const row = await loadStoreRow(storeId);
  const tz = row?.timezone?.trim() || "UTC";
  const currency = row?.currency?.trim() || null;
  const q = buildSiteHomeQuery(opts);
  const { p_period_start, p_period_end } = siteHomeStatsRpcPeriod(q, tz);
  return {
    tz,
    currency,
    p_store_id: storeId,
    p_tz: tz,
    p_currency: opts.combineAll ? null : currency,
    p_period_start,
    p_period_end,
    p_combine_all: opts.combineAll ?? false,
  };
}

type RpcRankRow = {
  product_id: number;
  name: string | null;
  sku: string | null;
  units: number;
  revenue: number;
  images?: unknown;
  image_mirror_urls?: unknown;
  local_id?: string | null;
};

function mapRankingForAssistant(row: RpcRankRow, storeId: string, reportingCurrency: string) {
  const thumb = getProductThumbnailWithMirrors(row.images, row.image_mirror_urls, "thumb");
  const rid = row.local_id ?? undefined;
  const rev = typeof row.revenue === "number" ? Math.round(row.revenue * 100) / 100 : row.revenue;
  return {
    id: rid,
    name: row.name ?? "Product",
    sku: row.sku ?? null,
    thumbnail_url: thumb,
    units: row.units,
    revenue: rev,
    revenue_display:
      typeof rev === "number" ? formatAssistantMoney(rev, reportingCurrency) : String(rev),
    woo_id: row.product_id,
    href: rid ? `/sites/${storeId}/products/edit/${rid}` : undefined,
  };
}

/** Rolling dashboard stats (same RPC as site home). Trimmed for assistant context. */
export async function fetchStoreSummaryForAssistant(storeId: string): Promise<unknown> {
  const row = await loadStoreRow(storeId);
  const tz = row?.timezone?.trim() || "UTC";
  const currency = row?.currency?.trim() || null;
  const { p_period_start, p_period_end } = siteHomeStatsRpcPeriod({ range: "30d" }, tz);

  const { data, error } = await supabaseAdmin.rpc("get_site_home_stats", {
    p_store_id: storeId,
    p_tz: tz,
    p_currency: currency,
    p_period_start,
    p_period_end,
    p_combine_all: false,
  });
  if (error) throw error;

  const { data: topCategoriesRaw, error: catErr } = await supabaseAdmin.rpc("get_top_selling_categories", {
    p_store_id: storeId,
    p_tz: tz,
    p_currency: currency,
    p_period_start,
    p_period_end,
    p_combine_all: false,
  });
  if (catErr) throw catErr;

  const raw = data as unknown as SiteStatsResponse & { snapshot_updated_at?: unknown };
  const recent = (raw.recent_orders ?? []).slice(0, 5).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    total: o.total,
    currency: o.currency,
    date_created: o.date_created,
  }));
  const reporting =
    (typeof raw.currency === "string" && raw.currency.trim()) ||
    (currency?.trim() || "USD").toUpperCase();

  const top = (raw.top_products ?? []).slice(0, 5).map((p) => ({
    name: p.name,
    units: p.units,
    revenue: p.revenue,
    revenue_display:
      typeof p.revenue === "number" ? formatAssistantMoney(p.revenue, reporting) : undefined,
    local_id: p.local_id,
    /** Public Woo/feature image URL when available — use in Markdown e.g. ![name](url) */
    image: p.image ?? null,
  }));

  const rawCats = Array.isArray(topCategoriesRaw) ? topCategoriesRaw : [];
  const topCategories = rawCats.slice(0, 10).map((c) => {
    const row = c && typeof c === "object" && !Array.isArray(c) ? (c as Record<string, unknown>) : {};
    const rev = row.revenue;
    return {
      ...row,
      revenue_display:
        typeof rev === "number" ? formatAssistantMoney(rev, reporting) : undefined,
    };
  });

  return {
    store_id: storeId,
    reporting_currency: reporting,
    store_timezone: tz,
    period_context:
      "Rolling window matches the site dashboard home (same ~30-day logic and revenue statuses); boundaries use the store timezone above.",
    stats: raw.stats,
    status_breakdown: raw.status_breakdown,
    recent_orders: recent,
    top_products: top,
    top_categories: topCategories,
    currency: raw.currency,
    meta: raw.meta,
    snapshot_updated_at: raw.snapshot_updated_at ?? null,
  };
}

/** Bounded product search for the assistant (name/SKU). */
export async function searchProductsForAssistant(storeId: string, query: string): Promise<unknown> {
  const sanitized = query.replace(/,/g, " ").trim();
  const q = escapeIlikePattern(sanitized).slice(0, 120);
  if (!q) return { products: [] };

  const pattern = `%${q}%`;
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, sku, stock_status, stock_quantity, status, woo_id, images, image_mirror_urls")
    .eq("store_id", storeId)
    .or(`name.ilike.${pattern},sku.ilike.${pattern}`)
    .limit(12);

  if (error) throw error;
  const rows = data ?? [];
  const rowMeta = await loadStoreRow(storeId);
  const reporting = (rowMeta?.currency?.trim() || "USD").toUpperCase();
  return {
    store_id: storeId,
    reporting_currency: reporting,
    store_timezone: rowMeta?.timezone?.trim() || "UTC",
    products: rows.map(({ images, image_mirror_urls, ...r }) => ({
      ...r,
      thumbnail_url: getProductThumbnailWithMirrors(images, image_mirror_urls, "thumb"),
    })),
  };
}

/** Period KPIs with vs-previous delta — aligns with dashboard revenue definition. */
export async function fetchAssistantPeriodKpis(storeId: string, opts: AssistantToolRangeOpts = {}): Promise<unknown> {
  const b = await rpcPeriodBundle(storeId, opts);
  const { data, error } = await supabaseAdmin.rpc("assistant_period_kpis", {
    p_store_id: b.p_store_id,
    p_tz: b.p_tz,
    p_currency: b.p_currency,
    p_period_start: b.p_period_start,
    p_period_end: b.p_period_end,
    p_combine_all: b.p_combine_all,
  });
  if (error) throw error;
  const payload = (data ?? {}) as {
    meta?: { currency?: string };
    current?: { revenue?: number };
    previous?: { revenue?: number };
    delta_pct?: unknown;
  };
  const reporting = (
    payload.meta?.currency?.trim() ||
    b.currency?.trim() ||
    "USD"
  ).toUpperCase();
  const curRev = payload.current?.revenue;
  const prevRev = payload.previous?.revenue;
  return {
    reporting_currency: reporting,
    store_timezone: b.tz,
    period_context: buildAssistantPeriodContext(opts, b),
    ...payload,
    current_revenue_display:
      typeof curRev === "number" ? formatAssistantMoney(curRev, reporting) : undefined,
    previous_revenue_display:
      typeof prevRev === "number" ? formatAssistantMoney(prevRev, reporting) : undefined,
  };
}

/** Top products by revenue or units for the selected window. */
export async function fetchAssistantProductRankings(
  storeId: string,
  opts: AssistantToolRangeOpts & { sort?: "revenue" | "units"; limit?: number } = {},
): Promise<unknown> {
  const b = await rpcPeriodBundle(storeId, opts);
  const { data, error } = await supabaseAdmin.rpc("assistant_product_rankings", {
    p_store_id: b.p_store_id,
    p_tz: b.p_tz,
    p_currency: b.p_currency,
    p_period_start: b.p_period_start,
    p_period_end: b.p_period_end,
    p_combine_all: b.p_combine_all,
    p_sort: opts.sort ?? "revenue",
    p_limit: opts.limit ?? 12,
  });
  if (error) throw error;
  const rows = (Array.isArray(data) ? data : []) as RpcRankRow[];
  const reporting = (b.currency?.trim() || "USD").toUpperCase();
  return {
    store_id: storeId,
    reporting_currency: reporting,
    store_timezone: b.tz,
    period_context: buildAssistantPeriodContext(opts, b),
    sort: opts.sort ?? "revenue",
    products: rows.map((r) => mapRankingForAssistant(r, storeId, reporting)),
  };
}

/** Low-stock summary + sample rows (mirrors enrich server-side). */
export async function fetchAssistantInventorySnapshot(
  storeId: string,
  opts: { lowStockThreshold?: number; limit?: number } = {},
): Promise<unknown> {
  const { data, error } = await supabaseAdmin.rpc("assistant_inventory_snapshot", {
    p_store_id: storeId,
    p_low_stock_threshold: opts.lowStockThreshold ?? 5,
    p_limit: opts.limit ?? 24,
  });
  if (error) throw error;
  const payload = data as {
    summary?: unknown;
    low_stock?: Array<{
      local_id?: string;
      name?: string;
      sku?: string | null;
      stock_status?: string | null;
      stock_quantity?: number | null;
      images?: unknown;
      image_mirror_urls?: unknown;
    }>;
  };
  const low = Array.isArray(payload?.low_stock) ? payload.low_stock : [];
  return {
    ...payload,
    low_stock: low.map((r) => ({
      ...r,
      thumbnail_url: getProductThumbnailWithMirrors(r.images, r.image_mirror_urls, "thumb"),
    })),
  };
}

/** Filtered recent orders (comma-separated statuses optional). */
export async function fetchAssistantOrdersFiltered(
  storeId: string,
  opts: AssistantToolRangeOpts & { statusCsv?: string | null; limit?: number } = {},
): Promise<unknown> {
  const b = await rpcPeriodBundle(storeId, opts);
  const { data, error } = await supabaseAdmin.rpc("assistant_orders_filtered", {
    p_store_id: b.p_store_id,
    p_tz: b.p_tz,
    p_status_csv: opts.statusCsv ?? null,
    p_period_start: b.p_period_start,
    p_period_end: b.p_period_end,
    p_limit: opts.limit ?? 25,
  });
  if (error) throw error;
  const reporting = (b.currency?.trim() || "USD").toUpperCase();
  return {
    store_id: storeId,
    reporting_currency: reporting,
    store_timezone: b.tz,
    period_context: buildAssistantPeriodContext(opts, b),
    orders: Array.isArray(data) ? data : [],
  };
}

/** Top customers + coupon code frequency for the window. */
export async function fetchAssistantCustomerCouponStats(
  storeId: string,
  opts: AssistantToolRangeOpts & { customerLimit?: number; couponLimit?: number } = {},
): Promise<unknown> {
  const b = await rpcPeriodBundle(storeId, opts);
  const { data, error } = await supabaseAdmin.rpc("assistant_customer_coupon_stats", {
    p_store_id: b.p_store_id,
    p_tz: b.p_tz,
    p_currency: b.p_currency,
    p_period_start: b.p_period_start,
    p_period_end: b.p_period_end,
    p_combine_all: b.p_combine_all,
    p_customer_limit: opts.customerLimit ?? 12,
    p_coupon_limit: opts.couponLimit ?? 12,
  });
  if (error) throw error;
  const reporting = (b.currency?.trim() || "USD").toUpperCase();
  return {
    reporting_currency: reporting,
    store_timezone: b.tz,
    period_context: buildAssistantPeriodContext(opts, b),
    ...(typeof data === "object" && data !== null && !Array.isArray(data) ? data : { data }),
  };
}

/** Frequent basket pairs + catalog QA — optional diagnostics beyond core dashboard tools. */
export async function fetchAssistantCommerceDiagnostics(storeId: string, opts: AssistantToolRangeOpts = {}): Promise<unknown> {
  const b = await rpcPeriodBundle(storeId, opts);
  const [pairsRes, catRes] = await Promise.all([
    supabaseAdmin.rpc("assistant_basket_pairs", {
      p_store_id: storeId,
      p_period_start: b.p_period_start,
      p_period_end: b.p_period_end,
      p_pair_limit: 15,
      p_max_orders: 400,
    }),
    supabaseAdmin.rpc("assistant_catalog_quality", { p_store_id: storeId }),
  ]);
  if (pairsRes.error) throw pairsRes.error;
  if (catRes.error) throw catRes.error;
  const reporting = (b.currency?.trim() || "USD").toUpperCase();
  return {
    reporting_currency: reporting,
    store_timezone: b.tz,
    period_context: buildAssistantPeriodContext(opts, b),
    basket_pairs: pairsRes.data ?? [],
    catalog_quality: catRes.data ?? {},
  };
}
