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

function diffFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: { field: string; old: unknown; new: unknown }[] = [];
  keys.forEach((k) => {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changes.push({ field: k, old: before[k], new: after[k] });
    }
  });
  return changes;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId, productId } = req.query;
  if (typeof storeId !== "string" || typeof productId !== "string") {
    return res.status(400).json({ error: "storeId and productId required" });
  }

  const { data: localProduct } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("store_id", storeId)
    .single();

  if (!localProduct?.woo_id) {
    return res.status(404).json({ error: "Product not found" });
  }

  const body = req.body || {};
  const { variations, ...rest } = body as Record<string, unknown> & { variations?: Array<Record<string, unknown>> };
  const wooPayload: Record<string, unknown> = { ...rest };

  const beforeSnapshot = toJson(localProduct);

  try {
    const store = await getStoreCreds(storeId);
    if (!store) throw new Error("Store not connected");

    const updated = await wooRequest<WooProduct>(
      store,
      "PUT",
      `products/${localProduct.woo_id}`,
      wooPayload
    );

    if (Array.isArray(variations) && updated.type === "variable") {
      const toCreate = variations.filter((v) => !v.id).map((v) => {
        const img = v.image && ((v.image as Record<string, unknown>).id || (v.image as Record<string, unknown>).src)
          ? { image: (v.image as Record<string, unknown>).id ? { id: (v.image as Record<string, unknown>).id } : { src: (v.image as Record<string, unknown>).src, alt: (v.image as Record<string, unknown>).alt || "" } }
          : {};
        return {
          regular_price: (v.regular_price as string) || "",
          sale_price: (v.sale_price as string) || "",
          sku: (v.sku as string) || "",
          manage_stock: !!v.manage_stock,
          stock_quantity: v.manage_stock ? v.stock_quantity : undefined,
          stock_status: (v.stock_status as string) || "instock",
          weight: (v.weight as string) || "",
          dimensions: v.dimensions || { length: "", width: "", height: "" },
          description: (v.description as string) || "",
          attributes: v.attributes || [],
          ...img,
        };
      });
      const toUpdate = variations.filter((v) => !!v.id).map((v) => ({
        id: v.id,
        regular_price: (v.regular_price as string) || "",
        sale_price: (v.sale_price as string) || "",
        sku: (v.sku as string) || "",
        manage_stock: !!v.manage_stock,
        stock_quantity: v.manage_stock ? v.stock_quantity : undefined,
        stock_status: (v.stock_status as string) || "instock",
        weight: (v.weight as string) || "",
        dimensions: v.dimensions || { length: "", width: "", height: "" },
        description: (v.description as string) || "",
      }));
      const batch: Record<string, unknown> = {};
      if (toCreate.length) batch.create = toCreate;
      if (toUpdate.length) batch.update = toUpdate;
      if (toCreate.length || toUpdate.length) {
        try {
          await wooRequest(store, "POST", `products/${localProduct.woo_id}/variations/batch`, batch);
        } catch (ve) {
          console.error("[variations-batch-update]", ve);
        }
      }
    }

    const now = new Date().toISOString();
    const updatePayload = {
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
    };

    const { data: saved, error: saveErr } = await supabaseAdmin
      .from("products")
      .update(updatePayload)
      .eq("id", productId)
      .select("*")
      .single();
    if (saveErr) throw saveErr;

    const afterSnapshot = toJson(saved);
    const changedFields = diffFields(
      localProduct as Record<string, unknown>,
      saved as Record<string, unknown>
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("entity_changes").insert({
      store_id: storeId,
      entity_type: "product",
      entity_id: productId,
      woo_id: localProduct.woo_id,
      entity_name: updated.name,
      change_type: "updated",
      changed_fields: changedFields as unknown as Json,
      snapshot_before: beforeSnapshot,
      snapshot_after: afterSnapshot,
      source: "dashboard",
      status: "success",
    });

    return res.status(200).json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[product update] error:", err);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("entity_changes").insert({
      store_id: storeId,
      entity_type: "product",
      entity_id: productId,
      woo_id: localProduct.woo_id,
      entity_name: localProduct.name,
      change_type: "update_failed",
      changed_fields: null,
      snapshot_before: beforeSnapshot,
      snapshot_after: null,
      source: "dashboard",
      status: "failed",
      error_message: message,
      retry_payload: toJson(wooPayload),
    });

    return res.status(500).json({
      error: "Failed to update product",
      message,
    });
  }
}