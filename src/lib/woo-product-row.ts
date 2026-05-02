import type { Json } from "@/integrations/supabase/database.types";

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

function toNumeric(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Maps a WooCommerce REST product payload to a `products` row (matches sync.ts ASPECTS.products.toRow). */
export function wooProductPayloadToRow(
  storeId: string,
  p: Record<string, unknown>,
  now: string
): Record<string, unknown> {
  return {
    store_id: storeId,
    woo_id: p.id as number,
    name: p.name,
    slug: p.slug,
    sku: p.sku || null,
    price: toNumeric(p.price),
    regular_price: toNumeric(p.regular_price),
    sale_price: toNumeric(p.sale_price),
    stock_quantity: p.stock_quantity,
    stock_status: p.stock_status,
    status: p.status,
    type: p.type,
    description: p.description,
    short_description: p.short_description,
    categories: toJson(p.categories),
    images: toJson(p.images),
    tags: toJson(p.tags || []),
    brands: toJson(p.brands || []),
    attributes: toJson(p.attributes || []),
    raw_data: toJson(p),
    synced_at: now,
  };
}
