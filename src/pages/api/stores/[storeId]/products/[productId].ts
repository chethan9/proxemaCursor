import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Json } from "@/integrations/supabase/database.types";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import { logActivity } from "@/lib/activity-log";

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

function variationChanged(
  incoming: Record<string, unknown>,
  row: Record<string, unknown>
): boolean {
  const pairs: [unknown, unknown][] = [
    [incoming.regular_price || "", row.regular_price != null ? String(row.regular_price) : ""],
    [incoming.sale_price || "", row.sale_price != null ? String(row.sale_price) : ""],
    [incoming.sku || "", row.sku || ""],
    [!!incoming.manage_stock, !!row.manage_stock],
    [incoming.manage_stock ? incoming.stock_quantity : null, row.manage_stock ? row.stock_quantity : null],
    [incoming.stock_status || "instock", row.stock_status || "instock"],
    [incoming.weight || "", row.weight || ""],
    [JSON.stringify(incoming.dimensions || {}), JSON.stringify(row.dimensions || {})],
    [incoming.description || "", row.description || ""],
    [(incoming.image && (incoming.image as Record<string, unknown>).id) || null, (row.image && (row.image as Record<string, unknown>).id) || null],
  ];
  return pairs.some(([a, b]) => JSON.stringify(a) !== JSON.stringify(b));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "PUT" && req.method !== "DELETE") {
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

  if (req.method === "GET") {
    return res.status(200).json(localProduct);
  }

  const beforeSnapshot = toJson(localProduct);

  if (req.method === "DELETE") {
    try {
      const store = await getStoreCreds(storeId);
      if (!store) throw new Error("Store not connected");
      const force = req.query.force !== "false";
      await wooRequest<WooProduct>(store, "DELETE", `products/${localProduct.woo_id}?force=${force}`);

      const { error: delErr } = await supabaseAdmin
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("store_id", storeId);
      if (delErr) throw delErr;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void (supabaseAdmin as any).from("entity_changes").insert({
        store_id: storeId,
        entity_type: "product",
        entity_id: productId,
        woo_id: localProduct.woo_id,
        entity_name: localProduct.name,
        change_type: "deleted",
        changed_fields: null,
        snapshot_before: beforeSnapshot,
        snapshot_after: null,
        source: "dashboard",
        status: "success",
      });

      void logActivity({
        action: "product.delete",
        entityType: "product",
        entityId: productId,
        before: localProduct as Record<string, unknown>,
        metadata: { woo_id: localProduct.woo_id, store_id: storeId },
        req,
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[product delete] error:", err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from("entity_changes").insert({
        store_id: storeId,
        entity_type: "product",
        entity_id: productId,
        woo_id: localProduct.woo_id,
        entity_name: localProduct.name,
        change_type: "delete_failed",
        changed_fields: null,
        snapshot_before: beforeSnapshot,
        snapshot_after: null,
        source: "dashboard",
        status: "failed",
        error_message: message,
      });
      return res.status(500).json({ error: "Failed to delete product", message });
    }
  }

  const body = req.body || {};
  const { variations, ...rest } = body as Record<string, unknown> & { variations?: Array<Record<string, unknown>> };
  const wooPayload: Record<string, unknown> = { ...rest };

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingRows } = await (supabaseAdmin as any)
        .from("product_variations")
        .select("*")
        .eq("store_id", storeId)
        .eq("product_id", productId);
      const byWooId = new Map<number, Record<string, unknown>>();
      (existingRows || []).forEach((r: Record<string, unknown>) => byWooId.set(r.woo_id as number, r));

      const toCreate: Record<string, unknown>[] = [];
      const toUpdate: Record<string, unknown>[] = [];

      for (const v of variations) {
        const img = v.image && ((v.image as Record<string, unknown>).id || (v.image as Record<string, unknown>).src)
          ? { image: (v.image as Record<string, unknown>).id ? { id: (v.image as Record<string, unknown>).id } : { src: (v.image as Record<string, unknown>).src, alt: (v.image as Record<string, unknown>).alt || "" } }
          : {};

        if (!v.id) {
          toCreate.push({
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
          });
          continue;
        }
        const existing = byWooId.get(v.id as number);
        if (existing && !variationChanged(v, existing)) continue;
        toUpdate.push({
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
          ...img,
        });
      }

      const batch: Record<string, unknown> = {};
      if (toCreate.length) batch.create = toCreate;
      if (toUpdate.length) batch.update = toUpdate;

      if (toCreate.length || toUpdate.length) {
        try {
          type BatchResp = { create?: Array<Record<string, unknown>>; update?: Array<Record<string, unknown>> };
          const resp = await wooRequest<BatchResp>(store, "POST", `products/${localProduct.woo_id}/variations/batch`, batch);
          const now = new Date().toISOString();
          const toUpsert: Record<string, unknown>[] = [];
          const process = (arr: Array<Record<string, unknown>> | undefined) => {
            (arr || []).forEach((v) => {
              const galleryMeta = Array.isArray(v.meta_data)
                ? (v.meta_data as { key: string; value: unknown }[]).find((m) => m.key === "_wc_additional_variation_images")
                : undefined;
              const galleryIds = Array.isArray(galleryMeta?.value) ? (galleryMeta!.value as number[]) : [];
              toUpsert.push({
                store_id: storeId,
                product_id: productId,
                woo_parent_id: localProduct.woo_id,
                woo_id: v.id as number,
                sku: (v.sku as string) || null,
                regular_price: v.regular_price ? parseFloat(v.regular_price as string) : null,
                sale_price: v.sale_price ? parseFloat(v.sale_price as string) : null,
                price: v.price ? parseFloat(v.price as string) : null,
                stock_quantity: (v.stock_quantity as number) ?? null,
                stock_status: (v.stock_status as string) || null,
                manage_stock: !!v.manage_stock,
                status: (v.status as string) || "publish",
                virtual: !!v.virtual,
                downloadable: !!v.downloadable,
                tax_class: (v.tax_class as string) || null,
                weight: (v.weight as string) || null,
                dimensions: toJson(v.dimensions || {}),
                description: (v.description as string) || null,
                attributes: toJson(v.attributes || []),
                image: v.image ? toJson(v.image) : null,
                gallery: toJson(galleryIds.map((id) => ({ id, src: "" }))),
                menu_order: (v.menu_order as number) || 0,
                raw_data: toJson(v),
                synced_at: now,
              });
            });
          };
          process(resp.create);
          process(resp.update);
          if (toUpsert.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin as any)
              .from("product_variations")
              .upsert(toUpsert, { onConflict: "store_id,woo_id", ignoreDuplicates: false });
          }
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
      manage_stock: (updated as unknown as { manage_stock?: boolean }).manage_stock ?? null,
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

    // Fire-and-forget entity_changes log (don't block response)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabaseAdmin as any).from("entity_changes").insert({
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

    void logActivity({
      action: "product.update",
      entityType: "product",
      entityId: productId,
      before: localProduct as Record<string, unknown>,
      after: saved as Record<string, unknown>,
      metadata: { woo_id: localProduct.woo_id, store_id: storeId },
      req,
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