import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import type { Json } from "@/integrations/supabase/database.types";
import { fetchPagesConcurrent, basicAuth } from "@/lib/sync-engine";
import { getAppUrl } from "@/lib/app-url";
import { waitUntil } from "@vercel/functions";

export const maxDuration = 300;
export const config = { maxDuration: 300 };

interface StoreToSync {
  id: string;
  name: string;
  url: string;
  consumer_key: string;
  consumer_secret: string;
  auth: string;
}

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

interface WooProduct { id: number; name: string; slug: string; sku: string; price: string; regular_price: string; sale_price: string; stock_quantity: number | null; stock_status: string; status: string; type: string; description: string; short_description: string; categories: unknown[]; images: unknown[]; attributes: unknown[]; date_created: string; date_modified: string; }
interface WooOrder { id: number; number: string; status: string; currency: string; total: string; discount_total: string; shipping_total: string; customer_id: number; billing: Record<string, unknown>; shipping: Record<string, unknown>; line_items: unknown[]; shipping_lines: unknown[]; fee_lines: unknown[]; coupon_lines: unknown[]; payment_method: string; payment_method_title: string; date_created: string; date_modified: string; }
interface WooCustomer { id: number; email: string; first_name: string; last_name: string; username: string; billing: Record<string, unknown>; shipping: Record<string, unknown>; avatar_url: string; is_paying_customer: boolean; orders_count: number; total_spent: string; date_created: string; date_modified: string; }
interface WooCategory { id: number; name: string; slug: string; parent: number; description: string; display: string; image: unknown; menu_order: number; count: number; }
interface WooCoupon { id: number; code: string; amount: string; discount_type: string; description: string; date_expires: string | null; usage_count: number; individual_use: boolean; product_ids: number[]; excluded_product_ids: number[]; usage_limit: number | null; usage_limit_per_user: number | null; free_shipping: boolean; minimum_amount: string; maximum_amount: string; date_created: string; date_modified: string; }
interface WooTag { id: number; name: string; slug: string; description: string; count: number; }

type Counters = { processed: number; created: number; updated: number };
type AspectResult = Counters & { error?: string };

/**
 * Persist one batch of rows to DB immediately, update sync_runs with running totals.
 * Called once per concurrent page batch from fetchPagesConcurrent.
 */
async function persistBatch(
  tableName: string,
  rows: Record<string, unknown>[],
  storeId: string,
  syncRunId: string,
  counters: Counters
): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.woo_id as number);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from(tableName)
    .select("woo_id")
    .eq("store_id", storeId)
    .in("woo_id", ids);
  const existingSet = new Set((existing || []).map((e: { woo_id: number }) => e.woo_id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from(tableName)
    .upsert(rows, { onConflict: "store_id,woo_id", ignoreDuplicates: false });
  if (error) throw new Error(`${tableName} upsert failed: ${error.message}`);
  const newCount = rows.filter((r) => !existingSet.has(r.woo_id as number)).length;
  counters.created += newCount;
  counters.updated += rows.length - newCount;
  counters.processed += rows.length;
  if (syncRunId) {
    await supabase.from("sync_runs").update({
      records_processed: counters.processed,
      records_created: counters.created,
      records_updated: counters.updated,
    }).eq("id", syncRunId);
  }
}

async function syncProducts(store: StoreToSync, syncRunId: string, modifiedAfter: string | null): Promise<AspectResult> {
  const counters: Counters = { processed: 0, created: 0, updated: 0 };
  const params: Record<string, string> = {};
  if (modifiedAfter) params.modified_after = modifiedAfter;
  await fetchPagesConcurrent<WooProduct>(store.url, store.auth, "products", params, {
    concurrency: 4,
    onBatch: async (items) => {
      const now = new Date().toISOString();
      const rows = items.map((p) => ({
        store_id: store.id, woo_id: p.id, name: p.name, slug: p.slug, sku: p.sku || null,
        price: p.price ? parseFloat(p.price) : null, regular_price: p.regular_price ? parseFloat(p.regular_price) : null,
        sale_price: p.sale_price ? parseFloat(p.sale_price) : null, stock_quantity: p.stock_quantity,
        stock_status: p.stock_status, status: p.status, type: p.type, description: p.description,
        short_description: p.short_description, categories: toJson(p.categories), images: toJson(p.images),
        attributes: toJson(p.attributes || []), raw_data: toJson(p), synced_at: now,
      }));
      await persistBatch("products", rows, store.id, syncRunId, counters);
    },
  });
  return counters;
}

async function syncOrders(store: StoreToSync, syncRunId: string, modifiedAfter: string | null): Promise<AspectResult> {
  const counters: Counters = { processed: 0, created: 0, updated: 0 };
  const params: Record<string, string> = {};
  if (modifiedAfter) params.modified_after = modifiedAfter;
  await fetchPagesConcurrent<WooOrder>(store.url, store.auth, "orders", params, {
    concurrency: 4,
    onBatch: async (items) => {
      const now = new Date().toISOString();
      const rows = items.map((o) => ({
        store_id: store.id, woo_id: o.id, order_number: o.number, status: o.status, currency: o.currency,
        total: o.total ? parseFloat(o.total) : null, discount_total: o.discount_total ? parseFloat(o.discount_total) : null,
        shipping_total: o.shipping_total ? parseFloat(o.shipping_total) : null, customer_id: o.customer_id || null,
        payment_method: o.payment_method || null, payment_method_title: o.payment_method_title || null,
        billing: toJson(o.billing), shipping: toJson(o.shipping), line_items: toJson(o.line_items),
        shipping_lines: toJson(o.shipping_lines || []), fee_lines: toJson(o.fee_lines || []),
        coupon_lines: toJson(o.coupon_lines || []), raw_data: toJson(o),
        date_created: o.date_created, date_modified: o.date_modified, synced_at: now,
      }));
      await persistBatch("orders", rows, store.id, syncRunId, counters);
    },
  });
  return counters;
}

async function syncCustomers(store: StoreToSync, syncRunId: string, modifiedAfter: string | null): Promise<AspectResult> {
  const counters: Counters = { processed: 0, created: 0, updated: 0 };
  const params: Record<string, string> = {};
  if (modifiedAfter) params.modified_after = modifiedAfter;
  await fetchPagesConcurrent<WooCustomer>(store.url, store.auth, "customers", params, {
    concurrency: 4,
    onBatch: async (items) => {
      const now = new Date().toISOString();
      const rows = items.map((c) => ({
        store_id: store.id, woo_id: c.id, email: c.email, first_name: c.first_name, last_name: c.last_name,
        username: c.username, role: null as string | null, billing: toJson(c.billing), shipping: toJson(c.shipping),
        avatar_url: c.avatar_url || null, is_paying_customer: c.is_paying_customer || false,
        orders_count: c.orders_count || 0, total_spent: c.total_spent ? parseFloat(c.total_spent) : null,
        raw_data: toJson(c), date_created: c.date_created, synced_at: now,
      }));
      await persistBatch("customers", rows, store.id, syncRunId, counters);
    },
  });
  return counters;
}

async function syncCategories(store: StoreToSync, syncRunId: string): Promise<AspectResult> {
  const counters: Counters = { processed: 0, created: 0, updated: 0 };
  await fetchPagesConcurrent<WooCategory>(store.url, store.auth, "products/categories", {}, {
    concurrency: 4,
    onBatch: async (items) => {
      const now = new Date().toISOString();
      const rows = items.map((c) => ({
        store_id: store.id, woo_id: c.id, name: c.name, slug: c.slug, parent_id: c.parent || null,
        description: c.description, display: c.display, image: toJson(c.image),
        menu_order: c.menu_order, count: c.count, raw_data: toJson(c), synced_at: now,
      }));
      await persistBatch("categories", rows, store.id, syncRunId, counters);
    },
  });
  return counters;
}

async function syncCoupons(store: StoreToSync, syncRunId: string, modifiedAfter: string | null): Promise<AspectResult> {
  const counters: Counters = { processed: 0, created: 0, updated: 0 };
  const params: Record<string, string> = {};
  if (modifiedAfter) params.modified_after = modifiedAfter;
  await fetchPagesConcurrent<WooCoupon>(store.url, store.auth, "coupons", params, {
    concurrency: 4,
    onBatch: async (items) => {
      const now = new Date().toISOString();
      const rows = items.map((c) => ({
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
      await persistBatch("coupons", rows, store.id, syncRunId, counters);
    },
  });
  return counters;
}

async function syncTags(store: StoreToSync, syncRunId: string): Promise<AspectResult> {
  const counters: Counters = { processed: 0, created: 0, updated: 0 };
  await fetchPagesConcurrent<WooTag>(store.url, store.auth, "products/tags", {}, {
    concurrency: 4,
    onBatch: async (items) => {
      const now = new Date().toISOString();
      const rows = items.map((t) => ({
        store_id: store.id, woo_id: t.id, name: t.name, slug: t.slug,
        description: t.description || "", count: t.count || 0, raw_data: toJson(t), synced_at: now,
      }));
      await persistBatch("tags", rows, store.id, syncRunId, counters);
    },
  });
  return counters;
}

/** Run one aspect with its own sync_runs row + benchmark. Catches errors. */
async function runAspect(
  storeId: string,
  aspectName: string,
  fn: (runId: string) => Promise<AspectResult>,
  isInitial: boolean
): Promise<AspectResult> {
  const { data: syncRun } = await supabase
    .from("sync_runs")
    .insert({ store_id: storeId, aspect: aspectName, status: "running", started_at: new Date().toISOString() })
    .select()
    .single();
  const start = Date.now();
  try {
    const result = await fn(syncRun?.id || "");
    const duration = (Date.now() - start) / 1000;
    if (syncRun?.id) {
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
      store_id: storeId, aspect: aspectName, record_count: result.processed,
      duration_seconds: duration, is_initial: isInitial,
    });
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Sync] Aspect ${aspectName} failed:`, msg);
    if (syncRun?.id) {
      await supabase.from("sync_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: msg,
      }).eq("id", syncRun.id);
    }
    return { processed: 0, created: 0, updated: 0, error: msg };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "PATCH") {
    const { storeId } = req.query;
    if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });
    const { data: allRunning } = await supabase.from("sync_runs").select("id").eq("store_id", storeId).eq("status", "running");
    const cancelIds = (allRunning || []).map((r) => r.id);
    if (cancelIds.length > 0) {
      await supabase.from("sync_runs").update({
        status: "failed", error_message: "Manually cancelled", completed_at: new Date().toISOString(),
      }).in("id", cancelIds);
    }
    await supabase.from("stores").update({ status: "connected" }).eq("id", storeId);
    return res.status(200).json({ cancelled: cancelIds.length });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { storeId } = req.query;
  const { aspect } = req.body || {};
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });

  try {
    const tenMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await supabase.from("sync_runs").update({
      status: "failed", error_message: "Auto-timeout: sync exceeded 30 minute limit",
      completed_at: new Date().toISOString(),
    }).eq("store_id", storeId).eq("status", "running").lt("started_at", tenMinAgo);

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, url, consumer_key, consumer_secret, last_sync_at, last_full_sync_at, initial_sync_completed_at, client_id, logo_url")
      .eq("id", storeId)
      .single();

    if (storeError || !store) return res.status(404).json({ error: "Store not found" });
    if (!store.consumer_key || !store.consumer_secret) return res.status(400).json({ error: "Store not connected - missing API credentials" });

    await supabase.from("stores").update({ status: "syncing" }).eq("id", storeId);

    const { data: allRow } = await supabase
      .from("sync_runs")
      .select("id, started_at, is_initial")
      .eq("store_id", storeId).eq("aspect", "all").eq("status", "running")
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    const allRunId = allRow?.id || null;
    const isInitial = !!allRow?.is_initial;

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const lastFull = store.last_full_sync_at ? new Date(store.last_full_sync_at).getTime() : 0;
    const fullSyncDue = !lastFull || (Date.now() - lastFull) > SEVEN_DAYS_MS;
    const useIncremental = !isInitial && !fullSyncDue && !!store.last_sync_at;

    let modifiedAfter: string | null = null;
    if (useIncremental && store.last_sync_at) {
      const t = new Date(store.last_sync_at).getTime() - 60 * 60 * 1000;
      modifiedAfter = new Date(t).toISOString();
    }

    const storeForSync: StoreToSync = {
      id: store.id, name: store.name || "", url: store.url,
      consumer_key: store.consumer_key, consumer_secret: store.consumer_secret,
      auth: basicAuth(store.consumer_key, store.consumer_secret),
    };

    if (aspect && aspect !== "all" && aspect !== "variations") {
      const fnMap: Record<string, (runId: string) => Promise<AspectResult>> = {
        products: (id) => syncProducts(storeForSync, id, modifiedAfter),
        orders: (id) => syncOrders(storeForSync, id, modifiedAfter),
        customers: (id) => syncCustomers(storeForSync, id, modifiedAfter),
        categories: (id) => syncCategories(storeForSync, id),
        tags: (id) => syncTags(storeForSync, id),
        coupons: (id) => syncCoupons(storeForSync, id, modifiedAfter),
      };
      if (!fnMap[aspect]) return res.status(400).json({ error: `Unknown aspect: ${aspect}` });
      const result = await runAspect(storeId, aspect, fnMap[aspect], false);
      await supabase.from("stores").update({ status: "connected", last_sync_at: new Date().toISOString() }).eq("id", storeId);
      return res.status(200).json({ success: true, store_id: storeId, results: { [aspect]: result } });
    }

    // All main aspects in parallel — each streams upserts as pages arrive
    const [products, orders, customers, categories, tags, coupons] = await Promise.all([
      runAspect(storeId, "products", (id) => syncProducts(storeForSync, id, modifiedAfter), isInitial),
      runAspect(storeId, "orders", (id) => syncOrders(storeForSync, id, modifiedAfter), isInitial),
      runAspect(storeId, "customers", (id) => syncCustomers(storeForSync, id, modifiedAfter), isInitial),
      runAspect(storeId, "categories", (id) => syncCategories(storeForSync, id), isInitial),
      runAspect(storeId, "tags", (id) => syncTags(storeForSync, id), isInitial),
      runAspect(storeId, "coupons", (id) => syncCoupons(storeForSync, id, modifiedAfter), isInitial),
    ]);

    const results = { products, orders, customers, categories, tags, coupons };
    const totalProcessed = Object.values(results).reduce((a, r) => a + r.processed, 0);
    const totalCreated = Object.values(results).reduce((a, r) => a + r.created, 0);
    const totalUpdated = Object.values(results).reduce((a, r) => a + r.updated, 0);

    const nowIso = new Date().toISOString();
    const storeUpdate: Record<string, unknown> = { status: "connected", last_sync_at: nowIso };
    if (!useIncremental) storeUpdate.last_full_sync_at = nowIso;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("stores").update(storeUpdate as any).eq("id", storeId);

    if (allRunId) {
      const allStart = allRow?.started_at ? new Date(allRow.started_at).getTime() : Date.now();
      const overallDuration = (Date.now() - allStart) / 1000;

      await supabase.from("sync_runs").update({
        status: "completed", completed_at: nowIso,
        records_processed: totalProcessed, records_created: totalCreated, records_updated: totalUpdated,
      }).eq("id", allRunId);

      if (isInitial || !store.initial_sync_completed_at) {
        await supabase.from("stores").update({ initial_sync_completed_at: nowIso }).eq("id", storeId).is("initial_sync_completed_at", null);

        const { data: storeFull } = await supabase.from("stores").select("name, url, logo_url, client_id").eq("id", storeId).maybeSingle();
        if (storeFull) {
          let userIds: string[] = [];
          if (storeFull.client_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: members } = await (supabase as any).from("client_members").select("user_id").eq("client_id", storeFull.client_id);
            userIds = ((members || []) as { user_id: string }[]).map((m) => m.user_id);
          }
          if (userIds.length === 0) {
            const { data: allUsers } = await supabase.from("profiles").select("id").limit(50);
            userIds = (allUsers || []).map((u: { id: string }) => u.id);
          }
          const rows = userIds.map((uid) => ({
            user_id: uid, type: "celebration",
            title: `${storeFull.name} is ready!`, body: "Welcome aboard. To infinity and beyond 🚀",
            cta_label: "Let's go", lottie_url: "/confetti.json", priority: 90,
            metadata: { store_id: storeId, store_name: storeFull.name, store_url: storeFull.url, logo_url: storeFull.logo_url },
          }));
          if (rows.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from("user_notifications").insert(rows);
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("sync_benchmarks").insert({
        store_id: storeId, aspect: "all", record_count: totalProcessed,
        duration_seconds: overallDuration, is_initial: isInitial,
      });
    }

    // Variations fire-and-forget — waitUntil keeps function alive on Vercel
    const base = getAppUrl(req);
    const variationsPromise = fetch(`${base}/api/stores/${storeId}/sync-variations`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    }).catch((e) => console.error("[Sync] variations trigger:", e));
    waitUntil(variationsPromise);

    return res.status(200).json({
      success: true,
      store_id: storeId,
      mode: useIncremental ? "incremental" : "full",
      results,
      totals: { processed: totalProcessed, created: totalCreated, updated: totalUpdated },
    });

  } catch (error) {
    console.error("[Sync API] Error:", error);
    await supabase.from("stores").update({ status: "error" }).eq("id", storeId);
    await supabase.from("sync_runs").update({
      status: "failed", completed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : "Unknown error",
    }).eq("store_id", storeId).eq("aspect", "all").eq("status", "running");
    return res.status(500).json({
      error: "Sync failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}