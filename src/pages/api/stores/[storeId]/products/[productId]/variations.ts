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

function mapRowToResponse(row: Record<string, unknown>) {
  const attributes = Array.isArray(row.attributes) ? (row.attributes as { name: string; option: string }[]) : [];
  const key = compositeVariationKey(attributes);
  const gallery = Array.isArray(row.gallery) ? (row.gallery as { id: number; src: string }[]) : [];
  const image = row.image as { id: number; src: string; alt: string } | null;
  return {
    id: row.woo_id,
    key,
    attributes,
    regular_price: row.regular_price != null ? String(row.regular_price) : "",
    sale_price: row.sale_price != null ? String(row.sale_price) : "",
    sku: (row.sku as string) || "",
    stock_quantity: row.stock_quantity,
    stock_status: (row.stock_status as string) || "instock",
    manage_stock: !!row.manage_stock,
    weight: (row.weight as string) || "",
    dimensions: (row.dimensions as { length: string; width: string; height: string }) || { length: "", width: "", height: "" },
    description: (row.description as string) || "",
    image: image ? { id: image.id, src: image.src, alt: image.alt } : null,
    gallery,
    enabled: (row.status as string) !== "private",
    virtual: !!row.virtual,
    downloadable: !!row.downloadable,
    tax_class: (row.tax_class as string) || "",
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

    return res.status(200).json(list.map(mapRowToResponse));
  } catch (e) {
    console.error("[variations-get]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Fetch failed" });
  }
}