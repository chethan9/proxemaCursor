import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Json } from "@/integrations/supabase/database.types";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

interface WooProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  stock_status: string;
  status: string;
  type: string;
  description: string;
  short_description: string;
  categories: unknown[];
  images: unknown[];
  attributes: unknown[];
  date_created: string;
  date_modified: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId, productId } = req.query;
  if (typeof storeId !== "string" || typeof productId !== "string") {
    return res.status(400).json({ error: "storeId and productId required" });
  }

  try {
    const store = await getStoreCreds(storeId);
    if (!store) return res.status(404).json({ error: "Store not connected" });

    // Find local product to get woo_id
    const { data: localProduct, error: localErr } = await supabaseAdmin
      .from("products")
      .select("id, woo_id")
      .eq("id", productId)
      .eq("store_id", storeId)
      .single();
    if (localErr || !localProduct?.woo_id) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Build WooCommerce update payload from body
    const {
      regular_price,
      sale_price,
      stock_quantity,
      stock_status,
      manage_stock,
      status,
    } = req.body || {};

    const wooPayload: Record<string, unknown> = {};
    if (regular_price !== undefined) wooPayload.regular_price = regular_price === null ? "" : String(regular_price);
    if (sale_price !== undefined) wooPayload.sale_price = sale_price === null ? "" : String(sale_price);
    if (stock_quantity !== undefined) wooPayload.stock_quantity = stock_quantity;
    if (stock_status !== undefined) wooPayload.stock_status = stock_status;
    if (manage_stock !== undefined) wooPayload.manage_stock = manage_stock;
    if (status !== undefined) wooPayload.status = status;

    // Push to WooCommerce
    const updated = await wooRequest<WooProduct>(
      store,
      "PUT",
      `products/${localProduct.woo_id}`,
      wooPayload
    );

    // Mirror to Supabase
    const now = new Date().toISOString();
    const { data: saved, error: saveErr } = await supabaseAdmin
      .from("products")
      .update({
        name: updated.name,
        slug: updated.slug,
        sku: updated.sku || null,
        price: updated.price ? parseFloat(updated.price) : null,
        regular_price: updated.regular_price ? parseFloat(updated.regular_price) : null,
        sale_price: updated.sale_price ? parseFloat(updated.sale_price) : null,
        stock_quantity: updated.stock_quantity,
        stock_status: updated.stock_status,
        status: updated.status,
        type: updated.type,
        description: updated.description,
        short_description: updated.short_description,
        categories: toJson(updated.categories),
        images: toJson(updated.images),
        attributes: toJson(updated.attributes || []),
        raw_data: toJson(updated),
        synced_at: now,
      })
      .eq("id", productId)
      .select("*")
      .single();

    if (saveErr) throw saveErr;
    return res.status(200).json(saved);
  } catch (err) {
    console.error("[product update] error:", err);
    return res.status(500).json({
      error: "Failed to update product",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}