import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import { authorizeCronOrStoreMember } from "@/lib/authorize-cron-or-store.server";
import type { Json } from "@/integrations/supabase/database.types";
import { fetchPagesConcurrent, basicAuth } from "@/lib/sync-engine";

export const maxDuration = 300;
export const config = { maxDuration: 300 };

interface WooVariation {
  id: number;
  sku: string;
  regular_price: string;
  sale_price: string;
  price: string;
  stock_quantity: number | null;
  stock_status: string;
  manage_stock: boolean;
  status: string;
  virtual: boolean;
  downloadable: boolean;
  tax_class: string;
  weight: string;
  dimensions: { length: string; width: string; height: string };
  description: string;
  attributes: { name: string; option: string }[];
  image: { id: number; src: string; alt: string } | null;
  menu_order: number;
  meta_data?: { key: string; value: unknown }[];
}

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

async function batchUpsert(tableName: string, rows: Record<string, unknown>[], conflictColumns: string) {
  if (rows.length === 0) return { created: 0, updated: 0 };
  const BATCH_SIZE = 200;
  let totalCreated = 0;
  let totalUpdated = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from(tableName)
      .select("store_id, woo_id")
      .in("woo_id", batch.map((r) => r.woo_id as number))
      .eq("store_id", batch[0].store_id as string);
    const existingSet = new Set((existing || []).map((e: { store_id: string; woo_id: number }) => `${e.store_id}_${e.woo_id}`));
    const newCount = batch.filter((r) => !existingSet.has(`${r.store_id}_${r.woo_id}`)).length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(tableName)
      .upsert(batch, { onConflict: conflictColumns, ignoreDuplicates: false });
    if (error) throw error;
    totalCreated += newCount;
    totalUpdated += batch.length - newCount;
  }
  return { created: totalCreated, updated: totalUpdated };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { storeId } = req.query;
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });

  const gate = await authorizeCronOrStoreMember(req, storeId);
  if (gate.ok === false) return res.status(gate.status).json({ error: gate.message });

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, url, consumer_key, consumer_secret")
    .eq("id", storeId)
    .single();

  if (storeError || !store || !store.consumer_key || !store.consumer_secret) {
    return res.status(400).json({ error: "Store not connected" });
  }

  // Create its own sync_runs row
  const { data: syncRun } = await supabase
    .from("sync_runs")
    .insert({ store_id: storeId, aspect: "variations", status: "running", started_at: new Date().toISOString() })
    .select()
    .single();

  const auth = basicAuth(store.consumer_key, store.consumer_secret);
  const now = new Date().toISOString();
  const aspectStart = Date.now();

  try {
    const { data: variableProducts } = await supabase
      .from("products")
      .select("id, woo_id")
      .eq("store_id", storeId)
      .eq("type", "variable");

    const parents = (variableProducts || []) as { id: string; woo_id: number }[];
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;

    // Process parents in concurrent batches
    const CONCURRENCY = 5;
    for (let i = 0; i < parents.length; i += CONCURRENCY) {
      const batch = parents.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (parent) => {
          const items = await fetchPagesConcurrent<WooVariation>(
            store.url,
            auth,
            `products/${parent.woo_id}/variations`,
            {},
            { concurrency: 2, perPage: 100 }
          );
          if (items.length === 0) return { processed: 0, created: 0, updated: 0 };
          const rows = items.map((v) => {
            const galleryMeta = (v.meta_data || []).find((m) => m.key === "_wc_additional_variation_images");
            const galleryIds = Array.isArray(galleryMeta?.value) ? (galleryMeta!.value as number[]) : [];
            return {
              store_id: storeId,
              product_id: parent.id,
              woo_parent_id: parent.woo_id,
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
              gallery: toJson(galleryIds.map((id) => ({ id, src: "" }))),
              menu_order: v.menu_order || 0,
              raw_data: toJson(v),
              synced_at: now,
            };
          });
          const result = await batchUpsert("product_variations", rows, "store_id,woo_id");
          return { processed: items.length, ...result };
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          totalProcessed += r.value.processed;
          totalCreated += r.value.created;
          totalUpdated += r.value.updated;
        } else {
          console.error("[sync-variations] batch parent failed:", r.reason);
        }
      }
      if (syncRun?.id) {
        await supabase.from("sync_runs").update({ records_processed: totalProcessed }).eq("id", syncRun.id);
      }
    }

    if (syncRun?.id) {
      await supabase.from("sync_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_processed: totalProcessed,
        records_created: totalCreated,
        records_updated: totalUpdated,
      }).eq("id", syncRun.id);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("sync_benchmarks").insert({
      store_id: storeId,
      aspect: "variations",
      record_count: totalProcessed,
      duration_seconds: (Date.now() - aspectStart) / 1000,
      is_initial: false,
    });

    return res.status(200).json({ success: true, processed: totalProcessed, created: totalCreated, updated: totalUpdated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (syncRun?.id) {
      await supabase.from("sync_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: msg,
      }).eq("id", syncRun.id);
    }
    return res.status(500).json({ error: msg });
  }
}