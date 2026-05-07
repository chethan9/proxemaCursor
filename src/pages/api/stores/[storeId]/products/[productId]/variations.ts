import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import type { Json } from "@/integrations/supabase/database.types";
import { compositeVariationKey } from "@/services/productEditService";

type WooVariation = {
  id: number;
  sku: string;
  regular_price: string;
  sale_price: string;
  price: string;
  stock_quantity: number | null;
  stock_status: string;
  manage_stock: boolean;
  weight: string;
  dimensions: { length: string; width: string; height: string };
  description: string;
  image: { id: number; src: string; alt: string } | null;
  attributes: { id?: number; name: string; option: string }[];
  status?: string;
  virtual?: boolean;
  downloadable?: boolean;
  tax_class?: string;
  menu_order?: number;
  meta_data?: { id?: number; key: string; value: unknown }[];
};

function toJson<T>(o: T): Json { return JSON.parse(JSON.stringify(o)) as Json; }

/** Prefer column `attributes`; fall back to `raw_data.attributes` (Woo snapshot) when the column was cleared or never backfilled. */
function variationAttributesFromRow(row: Record<string, unknown>): { name: string; option: string }[] {
  const direct = Array.isArray(row.attributes) ? (row.attributes as { name: string; option: string }[]) : [];
  if (direct.length > 0) return direct;
  const raw = row.raw_data;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const attrs = (raw as { attributes?: unknown }).attributes;
    if (Array.isArray(attrs) && attrs.length > 0) {
      return attrs as { name: string; option: string }[];
    }
  }
  return [];
}

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Woo batch/sync sometimes leaves typed columns null while `raw_data` still has the REST snapshot. */
function rawSnapshot(row: Record<string, unknown>): WooVariation | null {
  const raw = row.raw_data;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as WooVariation;
}

function regularPriceFromRow(row: Record<string, unknown>): string {
  if (row.regular_price != null && row.regular_price !== "") {
    const n = typeof row.regular_price === "number" ? row.regular_price : parseFloat(String(row.regular_price));
    if (Number.isFinite(n)) return String(row.regular_price).trim() || String(n);
  }
  const raw = rawSnapshot(row);
  if (raw) {
    const rp = trimStr(raw.regular_price);
    if (rp) return rp;
    const p = trimStr(raw.price);
    if (p) return p;
  }
  return "";
}

function salePriceFromRow(row: Record<string, unknown>): string {
  if (row.sale_price != null && row.sale_price !== "") {
    const n = typeof row.sale_price === "number" ? row.sale_price : parseFloat(String(row.sale_price));
    if (Number.isFinite(n)) return String(row.sale_price).trim() || String(n);
  }
  const raw = rawSnapshot(row);
  if (raw) {
    const sp = trimStr(raw.sale_price);
    if (sp) return sp;
  }
  return "";
}

function skuFromRow(row: Record<string, unknown>): string {
  const d = trimStr(row.sku);
  if (d) return d;
  const raw = rawSnapshot(row);
  return raw ? trimStr(raw.sku) : "";
}

function dimensionsFromRow(row: Record<string, unknown>): { length: string; width: string; height: string } {
  const d = row.dimensions as { length?: string; width?: string; height?: string } | null;
  if (d && (d.length || d.width || d.height)) {
    return {
      length: String(d.length || ""),
      width: String(d.width || ""),
      height: String(d.height || ""),
    };
  }
  const raw = rawSnapshot(row);
  if (raw?.dimensions && typeof raw.dimensions === "object") {
    const rd = raw.dimensions;
    return {
      length: trimStr(rd.length),
      width: trimStr(rd.width),
      height: trimStr(rd.height),
    };
  }
  return { length: "", width: "", height: "" };
}

function imageFromRow(row: Record<string, unknown>): { id: number; src: string; alt: string } | null {
  const image = row.image as { id: number; src: string; alt: string } | null;
  if (image?.src || image?.id) return { id: image.id, src: image.src, alt: image.alt || "" };
  const raw = rawSnapshot(row);
  if (raw?.image?.src || raw?.image?.id) {
    const im = raw.image;
    return { id: im.id, src: im.src, alt: im.alt || "" };
  }
  return null;
}

function mapRowToResponse(row: Record<string, unknown>) {
  const attributes = variationAttributesFromRow(row);
  const key = compositeVariationKey(attributes);
  const gallery = Array.isArray(row.gallery) ? (row.gallery as { id: number; src: string }[]) : [];
  const image = imageFromRow(row);
  const raw = rawSnapshot(row);
  let stockQty = row.stock_quantity as number | null;
  if (stockQty == null && raw && raw.stock_quantity != null) stockQty = raw.stock_quantity;
  let stockStatus = trimStr(row.stock_status) || "instock";
  if (!trimStr(row.stock_status) && raw?.stock_status) stockStatus = trimStr(raw.stock_status) || "instock";
  let manageStock = !!row.manage_stock;
  if (raw && typeof raw.manage_stock === "boolean") manageStock = raw.manage_stock;

  return {
    id: row.woo_id,
    key,
    attributes,
    regular_price: regularPriceFromRow(row),
    sale_price: salePriceFromRow(row),
    sku: skuFromRow(row),
    stock_quantity: stockQty,
    stock_status: stockStatus as "instock" | "outofstock" | "onbackorder",
    manage_stock: manageStock,
    weight: trimStr(row.weight) || (raw ? trimStr(raw.weight) : ""),
    dimensions: dimensionsFromRow(row),
    description: trimStr(row.description) || (raw ? trimStr(raw.description) : ""),
    image,
    gallery,
    enabled: (row.status as string) !== "private",
    virtual: typeof row.virtual === "boolean" ? row.virtual : !!raw?.virtual,
    downloadable: typeof row.downloadable === "boolean" ? row.downloadable : !!raw?.downloadable,
    tax_class: trimStr(row.tax_class) || (raw ? trimStr(raw.tax_class) : ""),
  };
}

async function fetchAndUpsert(storeId: string, productId: string, wooParentId: number) {
  const creds = await getStoreCreds(storeId);
  if (!creds) throw new Error("Store creds missing");

  const all: WooVariation[] = [];
  let page = 1;
  while (page < 20) {
    const batch = await wooRequest<WooVariation[]>(
      creds, "GET",
      `products/${wooParentId}/variations?per_page=100&page=${page}`
    );
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  if (all.length === 0) return [];

  const now = new Date().toISOString();
  const rows = all.map(v => {
    const galleryMeta = (v.meta_data || []).find(m => m.key === "_wc_additional_variation_images");
    const galleryIds = Array.isArray(galleryMeta?.value) ? (galleryMeta!.value as number[]) : [];
    return {
      store_id: storeId,
      product_id: productId,
      woo_parent_id: wooParentId,
      woo_id: v.id,
      sku: v.sku || null,
      regular_price: v.regular_price ? parseFloat(v.regular_price) : null,
      sale_price: v.sale_price ? parseFloat(v.sale_price) : null,
      price: v.price ? parseFloat(v.price) : null,
      stock_quantity: v.stock_quantity,
      stock_status: v.stock_status || null,
      manage_stock: !!v.manage_stock,
      status: v.status || "publish",
      virtual: !!v.virtual,
      downloadable: !!v.downloadable,
      tax_class: v.tax_class || null,
      weight: v.weight || null,
      dimensions: toJson(v.dimensions || {}),
      description: v.description || null,
      attributes: toJson(v.attributes || []),
      image: v.image ? toJson(v.image) : null,
      gallery: toJson(galleryIds.map(id => ({ id, src: "" }))),
      menu_order: v.menu_order || 0,
      raw_data: toJson(v),
      synced_at: now,
    };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from("product_variations")
    .upsert(rows, { onConflict: "store_id,woo_id", ignoreDuplicates: false });

  return rows;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { storeId, productId } = req.query;
  const refresh = req.query.refresh === "1";
  if (typeof storeId !== "string" || typeof productId !== "string") {
    return res.status(400).json({ error: "storeId/productId required" });
  }

  const { data: local } = await supabaseAdmin
    .from("products")
    .select("woo_id")
    .eq("id", productId)
    .eq("store_id", storeId)
    .single();
  if (!local?.woo_id) return res.status(404).json({ error: "Product not found" });

  try {
    if (refresh) {
      const rows = await fetchAndUpsert(storeId, productId, local.woo_id);
      return res.status(200).json(rows.map(mapRowToResponse));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabaseAdmin as any)
      .from("product_variations")
      .select("*")
      .eq("store_id", storeId)
      .eq("product_id", productId)
      .order("menu_order", { ascending: true });

    const list = (data || []) as Record<string, unknown>[];
    if (list.length === 0) {
      const rows = await fetchAndUpsert(storeId, productId, local.woo_id);
      return res.status(200).json(rows.map(mapRowToResponse));
    }

    let mappedList = list.map(mapRowToResponse);
    const allAttrsMissing =
      mappedList.length > 0 && mappedList.every((v) => (v.attributes?.length ?? 0) === 0);
    if (allAttrsMissing) {
      const rows = await fetchAndUpsert(storeId, productId, local.woo_id);
      mappedList = rows.map(mapRowToResponse);
      return res.status(200).json(mappedList);
    }

    const allPricesBlank =
      mappedList.length > 0 &&
      mappedList.every((v) => !trimStr(v.regular_price));
    if (allPricesBlank) {
      const rows = await fetchAndUpsert(storeId, productId, local.woo_id);
      mappedList = rows.map(mapRowToResponse);
      return res.status(200).json(mappedList);
    }
    return res.status(200).json(mappedList);
  } catch (e) {
    console.error("[variations-get]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Fetch failed" });
  }
}