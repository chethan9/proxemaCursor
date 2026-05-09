import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getProductThumbnailWithMirrors } from "@/lib/product-image-urls";
import type { SiteStatsResponse } from "@/services/siteStatsService";
import { siteHomeStatsRpcPeriod } from "@/services/siteStatsService";

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

  const raw = data as unknown as SiteStatsResponse & { snapshot_updated_at?: unknown };
  const recent = (raw.recent_orders ?? []).slice(0, 5).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    total: o.total,
    currency: o.currency,
    date_created: o.date_created,
  }));
  const top = (raw.top_products ?? []).slice(0, 5).map((p) => ({
    name: p.name,
    units: p.units,
    revenue: p.revenue,
    local_id: p.local_id,
    /** Public Woo/feature image URL when available — use in Markdown e.g. ![name](url) */
    image: p.image ?? null,
  }));

  return {
    store_id: storeId,
    store_timezone: tz,
    stats: raw.stats,
    status_breakdown: raw.status_breakdown,
    recent_orders: recent,
    top_products: top,
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
  return {
    store_id: storeId,
    products: rows.map(({ images, image_mirror_urls, ...r }) => ({
      ...r,
      thumbnail_url: getProductThumbnailWithMirrors(images, image_mirror_urls, "thumb"),
    })),
  };
}
