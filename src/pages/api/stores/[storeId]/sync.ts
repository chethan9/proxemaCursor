import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import type { Json } from "@/integrations/supabase/database.types";

interface StoreToSync {
  id: string;
  name: string;
  url: string;
  consumer_key: string;
  consumer_secret: string;
}

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

async function fetchAllFromWooCommerce<T>(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  const perPage = 100;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  while (true) {
    const url = new URL(`${storeUrl}/wp-json/wc/v3/${endpoint}`);
    url.searchParams.set("per_page", perPage.toString());
    url.searchParams.set("page", page.toString());
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`WooCommerce API timeout (30s) on ${endpoint} page ${page}`);
      }
      throw err;
    }
    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 400 || response.status === 404) break;
      throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
    }

    const items: T[] = await response.json();
    if (items.length === 0) break;
    allItems.push(...items);
    if (items.length < perPage || page >= 50) break;
    page++;
  }

  return allItems;
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
      .in("woo_id", batch.map(r => r.woo_id as number))
      .eq("store_id", batch[0].store_id as string);

    const existingSet = new Set((existing || []).map((e: { store_id: string; woo_id: number }) => `${e.store_id}_${e.woo_id}`));
    const newCount = batch.filter(r => !existingSet.has(`${r.store_id}_${r.woo_id}`)).length;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from(tableName)
      .upsert(batch, { onConflict: conflictColumns, ignoreDuplicates: false });

    if (error) {
      console.error(`[Sync] Batch upsert error on ${tableName}:`, error.message);
      throw error;
    }

    totalCreated += newCount;
    totalUpdated += batch.length - newCount;
  }

  return { created: totalCreated, updated: totalUpdated };
}

interface WooProduct { id: number; name: string; slug: string; sku: string; price: string; regular_price: string; sale_price: string; stock_quantity: number | null; stock_status: string; status: string; type: string; description: string; short_description: string; categories: unknown[]; images: unknown[]; attributes: unknown[]; date_created: string; date_modified: string; }
interface WooOrder { id: number; number: string; status: string; currency: string; total: string; discount_total: string; shipping_total: string; customer_id: number; billing: Record<string, unknown>; shipping: Record<string, unknown>; line_items: unknown[]; shipping_lines: unknown[]; fee_lines: unknown[]; coupon_lines: unknown[]; payment_method: string; payment_method_title: string; date_created: string; date_modified: string; }
interface WooCustomer { id: number; email: string; first_name: string; last_name: string; username: string; billing: Record<string, unknown>; shipping: Record<string, unknown>; avatar_url: string; is_paying_customer: boolean; orders_count: number; total_spent: string; date_created: string; date_modified: string; }
interface WooCategory { id: number; name: string; slug: string; parent: number; description: string; display: string; image: unknown; menu_order: number; count: number; }
interface WooCoupon { id: number; code: string; amount: string; discount_type: string; description: string; date_expires: string | null; usage_count: number; individual_use: boolean; product_ids: number[]; excluded_product_ids: number[]; usage_limit: number | null; usage_limit_per_user: number | null; free_shipping: boolean; minimum_amount: string; maximum_amount: string; date_created: string; date_modified: string; }
interface WooTag { id: number; name: string; slug: string; description: string; count: number; }

async function updateSyncRunProgress(syncRunId: string, recordsProcessed: number) {
  await supabase.from("sync_runs").update({ records_processed: recordsProcessed }).eq("id", syncRunId);
}

async function syncProducts(store: StoreToSync, syncRunId: string): Promise<{ processed: number; created: number; updated: number }> {
  const items = await fetchAllFromWooCommerce<WooProduct>(store.url, store.consumer_key, store.consumer_secret, "products");
  await updateSyncRunProgress(syncRunId, items.length);
  const now = new Date().toISOString();
  const rows = items.map(p => ({
    store_id: store.id, woo_id: p.id, name: p.name, slug: p.slug, sku: p.sku || null,
    price: p.price ? parseFloat(p.price) : null, regular_price: p.regular_price ? parseFloat(p.regular_price) : null,
    sale_price: p.sale_price ? parseFloat(p.sale_price) : null, stock_quantity: p.stock_quantity,
    stock_status: p.stock_status, status: p.status, type: p.type, description: p.description,
    short_description: p.short_description, categories: toJson(p.categories), images: toJson(p.images),
    attributes: toJson(p.attributes || []), raw_data: toJson(p), synced_at: now,
  }));
  const result = await batchUpsert("products", rows, "store_id,woo_id");
  return { processed: items.length, ...result };
}

async function syncOrders(store: StoreToSync, syncRunId: string): Promise<{ processed: number; created: number; updated: number }> {
  const items = await fetchAllFromWooCommerce<WooOrder>(store.url, store.consumer_key, store.consumer_secret, "orders");
  await updateSyncRunProgress(syncRunId, items.length);
  const now = new Date().toISOString();
  const rows = items.map(o => ({
    store_id: store.id, woo_id: o.id, order_number: o.number, status: o.status, currency: o.currency,
    total: o.total ? parseFloat(o.total) : null, discount_total: o.discount_total ? parseFloat(o.discount_total) : null,
    shipping_total: o.shipping_total ? parseFloat(o.shipping_total) : null, customer_id: o.customer_id || null,
    payment_method: o.payment_method || null, payment_method_title: o.payment_method_title || null,
    billing: toJson(o.billing), shipping: toJson(o.shipping), line_items: toJson(o.line_items),
    shipping_lines: toJson(o.shipping_lines || []), fee_lines: toJson(o.fee_lines || []),
    coupon_lines: toJson(o.coupon_lines || []), raw_data: toJson(o),
    date_created: o.date_created, date_modified: o.date_modified, synced_at: now,
  }));
  const result = await batchUpsert("orders", rows, "store_id,woo_id");
  return { processed: items.length, ...result };
}

async function syncCustomers(store: StoreToSync, syncRunId: string): Promise<{ processed: number; created: number; updated: number }> {
  const items = await fetchAllFromWooCommerce<WooCustomer>(store.url, store.consumer_key, store.consumer_secret, "customers");
  await updateSyncRunProgress(syncRunId, items.length);
  const now = new Date().toISOString();
  const rows = items.map(c => ({
    store_id: store.id, woo_id: c.id, email: c.email, first_name: c.first_name, last_name: c.last_name,
    username: c.username, role: null as string | null, billing: toJson(c.billing), shipping: toJson(c.shipping),
    avatar_url: c.avatar_url || null, is_paying_customer: c.is_paying_customer || false,
    orders_count: c.orders_count || 0, total_spent: c.total_spent ? parseFloat(c.total_spent) : null,
    raw_data: toJson(c), date_created: c.date_created, synced_at: now,
  }));
  const result = await batchUpsert("customers", rows, "store_id,woo_id");
  return { processed: items.length, ...result };
}

async function syncCategories(store: StoreToSync, syncRunId: string): Promise<{ processed: number; created: number; updated: number }> {
  const items = await fetchAllFromWooCommerce<WooCategory>(store.url, store.consumer_key, store.consumer_secret, "products/categories");
  await updateSyncRunProgress(syncRunId, items.length);
  const now = new Date().toISOString();
  const rows = items.map(c => ({
    store_id: store.id, woo_id: c.id, name: c.name, slug: c.slug, parent_id: c.parent || null,
    description: c.description, display: c.display, image: toJson(c.image),
    menu_order: c.menu_order, count: c.count, raw_data: toJson(c), synced_at: now,
  }));
  const result = await batchUpsert("categories", rows, "store_id,woo_id");
  return { processed: items.length, ...result };
}

async function syncCoupons(store: StoreToSync, syncRunId: string): Promise<{ processed: number; created: number; updated: number }> {
  const items = await fetchAllFromWooCommerce<WooCoupon>(store.url, store.consumer_key, store.consumer_secret, "coupons");
  await updateSyncRunProgress(syncRunId, items.length);
  const now = new Date().toISOString();
  const rows = items.map(c => ({
    store_id: store.id, woo_id: c.id, code: c.code,
    amount: c.amount ? parseFloat(c.amount) : null, discount_type: c.discount_type,
    description: c.description || "", date_expires: c.date_expires, usage_count: c.usage_count || 0,
    individual_use: c.individual_use || false, product_ids: toJson(c.product_ids || []),
    excluded_product_ids: toJson(c.excluded_product_ids || []), usage_limit: c.usage_limit,
    usage_limit_per_user: c.usage_limit_per_user, free_shipping: c.free_shipping || false,
    minimum_amount: c.minimum_amount ? parseFloat(c.minimum_amount) : null,
    maximum_amount: c.maximum_amount ? parseFloat(c.maximum_amount) : null,
    raw_data: toJson(c), date_created: c.date_created, synced_at: now,
  }));
  const result = await batchUpsert("coupons", rows, "store_id,woo_id");
  return { processed: items.length, ...result };
}

async function syncTags(store: StoreToSync, syncRunId: string): Promise<{ processed: number; created: number; updated: number }> {
  const items = await fetchAllFromWooCommerce<WooTag>(store.url, store.consumer_key, store.consumer_secret, "products/tags");
  await updateSyncRunProgress(syncRunId, items.length);
  const now = new Date().toISOString();
  const rows = items.map(t => ({
    store_id: store.id, woo_id: t.id, name: t.name, slug: t.slug,
    description: t.description || "", count: t.count || 0, raw_data: toJson(t), synced_at: now,
  }));
  const result = await batchUpsert("tags", rows, "store_id,woo_id");
  return { processed: items.length, ...result };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "PATCH") {
    const { storeId } = req.query;
    if (!storeId || typeof storeId !== "string") {
      return res.status(400).json({ error: "Store ID required" });
    }

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: staleRuns } = await supabase
      .from("sync_runs")
      .select("id")
      .eq("store_id", storeId)
      .eq("status", "running")
      .lt("started_at", tenMinAgo);

    const runningIds = (staleRuns || []).map(r => r.id);

    const { data: allRunning } = await supabase
      .from("sync_runs")
      .select("id")
      .eq("store_id", storeId)
      .eq("status", "running");

    const cancelIds = (allRunning || []).map(r => r.id);

    if (cancelIds.length > 0) {
      await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          error_message: "Manually cancelled",
          completed_at: new Date().toISOString(),
        })
        .in("id", cancelIds);
    }

    await supabase.from("stores").update({ status: "connected" }).eq("id", storeId);

    return res.status(200).json({ cancelled: cancelIds.length });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId } = req.query;
  const { aspect } = req.body || {};

  if (!storeId || typeof storeId !== "string") {
    return res.status(400).json({ error: "Store ID required" });
  }

  try {
    // Auto-timeout: mark stuck running syncs (>10 min) as failed
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from("sync_runs")
      .update({
        status: "failed",
        error_message: "Auto-timeout: sync exceeded 10 minute limit",
        completed_at: new Date().toISOString(),
      })
      .eq("store_id", storeId)
      .eq("status", "running")
      .lt("started_at", tenMinAgo);

    // Also reset store status if it was stuck in "syncing"
    const { data: stuckStore } = await supabase
      .from("stores")
      .select("status, last_sync_at")
      .eq("id", storeId)
      .single();

    if (stuckStore?.status === "syncing") {
      const noRunning = await supabase
        .from("sync_runs")
        .select("id")
        .eq("store_id", storeId)
        .eq("status", "running")
        .limit(1);
      if (!noRunning.data?.length) {
        await supabase.from("stores").update({ status: "connected" }).eq("id", storeId);
      }
    }

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, url, consumer_key, consumer_secret")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      return res.status(404).json({ error: "Store not found" });
    }

    if (!store.consumer_key || !store.consumer_secret) {
      return res.status(400).json({ error: "Store not connected - missing API credentials" });
    }

    await supabase.from("stores").update({ status: "syncing" }).eq("id", storeId);

    // Track the "all" placeholder row (created by sync-start) so we can close it
    const { data: allRow } = await supabase
      .from("sync_runs")
      .select("id")
      .eq("store_id", storeId)
      .eq("aspect", "all")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const allRunId = allRow?.id || null;

    const syncFunctions: Record<string, (s: StoreToSync, runId: string) => Promise<{ processed: number; created: number; updated: number }>> = {
      products: syncProducts,
      orders: syncOrders,
      customers: syncCustomers,
      categories: syncCategories,
      tags: syncTags,
      coupons: syncCoupons,
    };

    const aspectsToSync = aspect && syncFunctions[aspect]
      ? [aspect]
      : Object.keys(syncFunctions);

    const results: Record<string, { processed: number; created: number; updated: number; error?: string }> = {};
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;

    for (const asp of aspectsToSync) {
      const { data: syncRun } = await supabase
        .from("sync_runs")
        .insert({
          store_id: storeId,
          aspect: asp,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      const aspectStart = Date.now();
      try {
        const result = await syncFunctions[asp](store as StoreToSync, syncRun?.id || "");
        const durationSec = (Date.now() - aspectStart) / 1000;
        results[asp] = result;
        totalProcessed += result.processed;
        totalCreated += result.created;
        totalUpdated += result.updated;

        if (syncRun) {
          await supabase.from("sync_runs").update({
            status: "completed",
            completed_at: new Date().toISOString(),
            records_processed: result.processed,
            records_created: result.created,
            records_updated: result.updated,
          }).eq("id", syncRun.id);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("sync_benchmarks").insert({
          store_id: storeId,
          aspect: asp,
          record_count: result.processed,
          duration_seconds: durationSec,
          is_initial: !!allRunId,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        results[asp] = { processed: 0, created: 0, updated: 0, error: errorMsg };

        if (syncRun) {
          await supabase.from("sync_runs").update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: errorMsg,
          }).eq("id", syncRun.id);
        }
      }
    }

    await supabase.from("stores").update({
      status: "connected",
      last_sync_at: new Date().toISOString(),
    }).eq("id", storeId);

    // Close the "all" placeholder row with aggregated totals
    if (allRunId) {
      const allStart = allRow?.id ? new Date((await supabase.from("sync_runs").select("started_at").eq("id", allRunId).single()).data?.started_at || Date.now()).getTime() : Date.now();
      const overallDuration = (Date.now() - allStart) / 1000;

      await supabase.from("sync_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        records_processed: totalProcessed,
        records_created: totalCreated,
        records_updated: totalUpdated,
      }).eq("id", allRunId);

      // Check if this was the initial sync — stamp stores.initial_sync_completed_at (only if not already set)
      const { data: allRunRow } = await supabase
        .from("sync_runs")
        .select("is_initial")
        .eq("id", allRunId)
        .maybeSingle();
      if (allRunRow?.is_initial) {
        await supabase
          .from("stores")
          .update({ initial_sync_completed_at: new Date().toISOString() })
          .eq("id", storeId)
          .is("initial_sync_completed_at", null);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("sync_benchmarks").insert({
        store_id: storeId,
        aspect: "all",
        record_count: totalProcessed,
        duration_seconds: overallDuration,
        is_initial: true,
      });
    }

    return res.status(200).json({
      success: true,
      store_id: storeId,
      results,
      totals: { processed: totalProcessed, created: totalCreated, updated: totalUpdated },
    });

  } catch (error) {
    console.error("[Sync API] Error:", error);
    await supabase.from("stores").update({ status: "error" }).eq("id", storeId);
    // Fail the "all" row too so banner unmounts
    await supabase
      .from("sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("store_id", storeId)
      .eq("aspect", "all")
      .eq("status", "running");
    return res.status(500).json({
      error: "Sync failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}