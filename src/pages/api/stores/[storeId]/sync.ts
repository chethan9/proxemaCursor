import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import type { Json } from "@/integrations/supabase/database.types";

interface StoreToSync {
  id: string;
  name: string;
  url: string;
  consumer_key: string;
  consumer_secret: string;
}

const CORE_ASPECTS = ["products", "orders", "customers", "categories"];
const SECONDARY_ASPECTS = ["variations", "tags", "coupons"];

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
interface WooVariation { id: number; sku: string; regular_price: string; sale_price: string; price: string; stock_quantity: number | null; stock_status: string; manage_stock: boolean; status: string; virtual: boolean; downloadable: boolean; tax_class: string; weight: string; dimensions: { length: string; width: string; height: string }; description: string; attributes: { name: string; option: string }[]; image: { id: number; src: string; alt: string } | null; menu_order: number; meta_data?: { key: string; value: unknown }[]; }

async function updateSyncRunProgress(syncRunId: string, recordsProcessed: number) {
  if (!syncRunId) return;
  await supabase.from("sync_runs").update({ records_processed: recordsProcessed }).eq("id", syncRunId);
}

async function syncProducts(store: StoreToSync, syncRunId: string) {
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

async function syncOrders(store: StoreToSync, syncRunId: string) {
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

async function syncCustomers(store: StoreToSync, syncRunId: string) {
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

async function syncCategories(store: StoreToSync, syncRunId: string) {
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

async function syncCoupons(store: StoreToSync, syncRunId: string) {
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

async function syncTags(store: StoreToSync, syncRunId: string) {
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

async function syncVariations(store: StoreToSync, syncRunId: string) {
  const { data: variableProducts } = await supabase
    .from("products")
    .select("id, woo_id")
    .eq("store_id", store.id)
    .eq("type", "variable");

  const parents = (variableProducts || []) as { id: string; woo_id: number }[];
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  const now = new Date().toISOString();

  for (const parent of parents) {
    try {
      const items = await fetchAllFromWooCommerce<WooVariation>(
        store.url, store.consumer_key, store.consumer_secret,
        `products/${parent.woo_id}/variations`
      );
      if (items.length === 0) continue;
      const rows = items.map(v => {
        const galleryMeta = (v.meta_data || []).find(m => m.key === "_wc_additional_variation_images");
        const galleryIds = Array.isArray(galleryMeta?.value) ? (galleryMeta!.value as number[]) : [];
        return {
          store_id: store.id,
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
          gallery: toJson(galleryIds.map(id => ({ id, src: "" }))),
          menu_order: v.menu_order || 0,
          raw_data: toJson(v),
          synced_at: now,
        };
      });
      const result = await batchUpsert("product_variations", rows, "store_id,woo_id");
      totalProcessed += items.length;
      totalCreated += result.created;
      totalUpdated += result.updated;
      await updateSyncRunProgress(syncRunId, totalProcessed);
    } catch (e) {
      console.error(`[syncVariations] parent ${parent.woo_id}:`, e);
    }
  }
  return { processed: totalProcessed, created: totalCreated, updated: totalUpdated };
}

const SYNC_FUNCTIONS: Record<string, (s: StoreToSync, runId: string) => Promise<{ processed: number; created: number; updated: number }>> = {
  products: syncProducts,
  orders: syncOrders,
  customers: syncCustomers,
  categories: syncCategories,
  tags: syncTags,
  coupons: syncCoupons,
  variations: syncVariations,
};

async function notifyUsers(storeId: string, params: {
  type: string; title: string; body: string; cta_label?: string; cta_url?: string | null; lottie_url?: string | null; priority?: number; metadata?: Record<string, unknown>;
}) {
  const { data: storeFull } = await supabase.from("stores").select("name, url, logo_url, client_id").eq("id", storeId).maybeSingle();
  if (!storeFull) return;
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
  if (userIds.length === 0) return;
  const rows = userIds.map((uid) => ({
    user_id: uid,
    type: params.type,
    title: params.title,
    body: params.body,
    cta_label: params.cta_label || null,
    cta_url: params.cta_url || null,
    lottie_url: params.lottie_url || null,
    priority: params.priority ?? 50,
    metadata: { store_id: storeId, store_name: storeFull.name, store_url: storeFull.url, logo_url: storeFull.logo_url, ...(params.metadata || {}) },
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("user_notifications").insert(rows);
}

async function runPhase(
  store: StoreToSync,
  phase: "core" | "secondary",
  aspects: string[],
  placeholderId: string | null
): Promise<{ results: Record<string, { processed: number; created: number; updated: number; error?: string }>; totals: { processed: number; created: number; updated: number }; failedAspects: string[] }> {
  const results: Record<string, { processed: number; created: number; updated: number; error?: string }> = {};
  let totalProcessed = 0, totalCreated = 0, totalUpdated = 0;

  for (const asp of aspects) {
    const { data: syncRun } = await supabase
      .from("sync_runs")
      .insert({ store_id: store.id, aspect: asp, status: "running", started_at: new Date().toISOString() })
      .select().single();

    try {
      const result = await SYNC_FUNCTIONS[asp](store, syncRun?.id || "");
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

  const failedAspects = Object.entries(results).filter(([, r]) => r.error).map(([a]) => a);

  if (placeholderId) {
    await supabase.from("sync_runs").update({
      status: failedAspects.length > 0 && failedAspects.length === aspects.length ? "failed" : "completed",
      completed_at: new Date().toISOString(),
      records_processed: totalProcessed,
      records_created: totalCreated,
      records_updated: totalUpdated,
      error_message: failedAspects.length > 0 ? `Failed: ${failedAspects.join(", ")}` : null,
    }).eq("id", placeholderId);
  }

  return { results, totals: { processed: totalProcessed, created: totalCreated, updated: totalUpdated }, failedAspects };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "PATCH") {
    const { storeId } = req.query;
    if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });
    const { data: allRunning } = await supabase.from("sync_runs").select("id").eq("store_id", storeId).eq("status", "running");
    const cancelIds = (allRunning || []).map(r => r.id);
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
  const { phase, aspect } = req.body || {};
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });

  try {
    // Auto-timeout stuck runs
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase.from("sync_runs").update({
      status: "failed",
      error_message: "Auto-timeout: sync exceeded 10 minute limit",
      completed_at: new Date().toISOString(),
    }).eq("store_id", storeId).eq("status", "running").lt("started_at", tenMinAgo);

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, name, url, consumer_key, consumer_secret, initial_sync_completed_at")
      .eq("id", storeId).single();
    if (storeError || !store) return res.status(404).json({ error: "Store not found" });
    if (!store.consumer_key || !store.consumer_secret) return res.status(400).json({ error: "Store not connected - missing API credentials" });

    await supabase.from("stores").update({ status: "syncing" }).eq("id", storeId);

    // Determine mode
    const isSingleAspect = aspect && SYNC_FUNCTIONS[aspect];
    const isPhase = phase === "core" || phase === "secondary" || phase === "all";

    // Single-aspect manual sync
    if (isSingleAspect && !isPhase) {
      const storeToSync = store as StoreToSync;
      const phaseResult = await runPhase(storeToSync, "core", [aspect as string], null);
      await supabase.from("stores").update({ status: "connected", last_sync_at: new Date().toISOString() }).eq("id", storeId);
      return res.status(200).json({ success: true, results: phaseResult.results });
    }

    const targetPhase: "core" | "secondary" | "all" = isPhase ? phase : "core";
    const storeToSync = store as StoreToSync;

    // Find or create placeholder for this phase
    const phaseAspects = targetPhase === "secondary" ? SECONDARY_ASPECTS : CORE_ASPECTS;

    // CORE phase (or ALL: run core, then secondary)
    if (targetPhase === "core" || targetPhase === "all") {
      const { data: existingPlaceholder } = await supabase
        .from("sync_runs").select("id")
        .eq("store_id", storeId)
        .in("aspect", ["core", "all"])
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(1).maybeSingle();

      let corePlaceholderId = existingPlaceholder?.id || null;
      if (!corePlaceholderId) {
        const { data: newPh } = await supabase.from("sync_runs").insert({
          store_id: storeId, aspect: "core", status: "running", started_at: new Date().toISOString(),
          is_initial: !store.initial_sync_completed_at,
        }).select().single();
        corePlaceholderId = newPh?.id || null;
      }

      const coreResult = await runPhase(storeToSync, "core", CORE_ASPECTS, corePlaceholderId);
      const coreFailed = coreResult.failedAspects.length > 0;

      // Stamp initial_sync_completed_at only if core succeeded and not already stamped
      if (!coreFailed && !store.initial_sync_completed_at) {
        await supabase.from("stores").update({ initial_sync_completed_at: new Date().toISOString() }).eq("id", storeId).is("initial_sync_completed_at", null);
      }

      // Celebration on core success
      if (!coreFailed) {
        await notifyUsers(storeId, {
          type: "celebration",
          title: `${store.name} is ready!`,
          body: "Core sync complete. Explore products, orders, customers — we're polishing the rest in the background 🚀",
          cta_label: "Let's go",
          cta_url: `/sites/${storeId}/products`,
          lottie_url: "/confetti.json",
          priority: 90,
        });
      } else {
        await notifyUsers(storeId, {
          type: "sync_failure",
          title: `Sync issue on ${store.name}`,
          body: `${coreResult.failedAspects.join(", ")} failed to sync. Open the sync engine to retry.`,
          cta_label: "Open sync engine",
          cta_url: `/projects/${storeId}?tab=sync`,
          priority: 80,
          metadata: { failed_aspects: coreResult.failedAspects },
        });
      }

      // Auto-kick secondary phase (fire-and-forget) if core succeeded or partial
      if (targetPhase === "core" || targetPhase === "all") {
        // Guard: skip if secondary already running
        const { data: secRunning } = await supabase.from("sync_runs").select("id").eq("store_id", storeId).eq("aspect", "secondary").eq("status", "running").limit(1);
        if (!secRunning || secRunning.length === 0) {
          const base = getAppUrl(req);
          fetch(`${base}/api/stores/${storeId}/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phase: "secondary" }),
          }).catch((e) => console.error("[sync] bg secondary trigger:", e));
        }
      }

      await supabase.from("stores").update({
        status: coreFailed ? "error" : "connected",
        last_sync_at: new Date().toISOString(),
      }).eq("id", storeId);

      return res.status(200).json({
        success: true, phase: "core",
        results: coreResult.results,
        totals: coreResult.totals,
        secondary_triggered: true,
      });
    }

    // SECONDARY phase
    if (targetPhase === "secondary") {
      const { data: existingPlaceholder } = await supabase
        .from("sync_runs").select("id")
        .eq("store_id", storeId).eq("aspect", "secondary").eq("status", "running")
        .order("started_at", { ascending: false }).limit(1).maybeSingle();

      let secondaryPlaceholderId = existingPlaceholder?.id || null;
      if (!secondaryPlaceholderId) {
        const { data: newPh } = await supabase.from("sync_runs").insert({
          store_id: storeId, aspect: "secondary", status: "running", started_at: new Date().toISOString(),
        }).select().single();
        secondaryPlaceholderId = newPh?.id || null;
      }

      const secondaryResult = await runPhase(storeToSync, "secondary", phaseAspects, secondaryPlaceholderId);

      if (secondaryResult.failedAspects.length > 0) {
        await notifyUsers(storeId, {
          type: "sync_failure",
          title: `Background sync issue on ${store.name}`,
          body: `${secondaryResult.failedAspects.join(", ")} couldn't be backfilled. You can retry from the sync engine.`,
          cta_label: "Open sync engine",
          cta_url: `/projects/${storeId}?tab=sync`,
          priority: 40,
          metadata: { failed_aspects: secondaryResult.failedAspects, phase: "secondary" },
        });
      } else {
        await notifyUsers(storeId, {
          type: "secondary_complete",
          title: `${store.name} fully synced ✨`,
          body: "Variations, tags and coupons are all backfilled.",
          cta_label: "View data",
          cta_url: `/sites/${storeId}/products`,
          priority: 30,
        });
      }

      // Only update store status if it's not already in a core-failed state
      const { data: currentStore } = await supabase.from("stores").select("status").eq("id", storeId).maybeSingle();
      if (currentStore?.status !== "error") {
        await supabase.from("stores").update({ status: "connected", last_sync_at: new Date().toISOString() }).eq("id", storeId);
      }

      return res.status(200).json({ success: true, phase: "secondary", results: secondaryResult.results, totals: secondaryResult.totals });
    }

    return res.status(400).json({ error: "Invalid phase/aspect combination" });
  } catch (error) {
    console.error("[Sync API] Error:", error);
    await supabase.from("stores").update({ status: "error" }).eq("id", storeId);
    await supabase.from("sync_runs").update({
      status: "failed", completed_at: new Date().toISOString(),
      error_message: error instanceof Error ? error.message : "Unknown error",
    }).eq("store_id", storeId).in("aspect", ["core", "secondary", "all"]).eq("status", "running");
    return res.status(500).json({ error: "Sync failed", message: error instanceof Error ? error.message : "Unknown error" });
  }
}