import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import type { Json } from "@/integrations/supabase/database.types";
import { WOO_USER_AGENT, isRetryableError, nextRetryDelaySeconds, MAX_SYNC_ATTEMPTS } from "@/lib/sync-error";

interface StoreToSync {
  id: string;
  name: string;
  url: string;
  consumer_key: string;
  consumer_secret: string;
  sync_interval: number;
  next_sync_at: string | null;
}

interface SyncResult { processed: number; created: number; updated: number; isDelta: boolean }

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

async function getWatermark(storeId: string, aspect: string): Promise<string | null> {
  const { data } = await supabase
    .from("store_aspect_sync_state")
    .select("last_synced_at")
    .eq("store_id", storeId)
    .eq("aspect", aspect)
    .maybeSingle();
  return data?.last_synced_at || null;
}

async function setWatermark(storeId: string, aspect: string, recordsSeen: number, syncedAt: string): Promise<void> {
  await supabase
    .from("store_aspect_sync_state")
    .upsert({
      store_id: storeId,
      aspect,
      last_synced_at: syncedAt,
      last_completed_at: new Date().toISOString(),
      records_seen: recordsSeen,
    }, { onConflict: "store_id,aspect" });
}

async function fetchAllFromWooCommerce<T>(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  endpoint: string,
  modifiedAfter?: string | null,
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  while (hasMore) {
    const url = new URL(`${storeUrl}/wp-json/wc/v3/${endpoint}`);
    url.searchParams.set("per_page", perPage.toString());
    url.searchParams.set("page", page.toString());
    if (modifiedAfter) {
      // WooCommerce expects ISO8601 in site timezone but accepts UTC. Use UTC.
      url.searchParams.set("modified_after", modifiedAfter);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json", "User-Agent": WOO_USER_AGENT },
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
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    const items: T[] = await response.json();
    if (items.length === 0) {
      hasMore = false;
    } else {
      allItems.push(...items);
      if (items.length < perPage) hasMore = false;
      else page++;
    }
    // Safety: cap at 500 pages = 50k records per aspect per run.
    // With incremental sync this should never trigger except on first full sync of huge stores.
    if (page > 500) {
      console.warn(`[Sync] Hit 500-page safety cap on ${endpoint} — store has 50k+ records in this delta`);
      hasMore = false;
    }
  }
  return allItems;
}

interface WooBase { id: number; date_modified?: string; date_modified_gmt?: string }

async function syncProducts(store: StoreToSync): Promise<SyncResult> {
  const watermark = await getWatermark(store.id, "products");
  const startedAt = new Date().toISOString();
  const products = await fetchAllFromWooCommerce<WooBase & Record<string, unknown>>(
    store.url, store.consumer_key, store.consumer_secret, "products", watermark
  );
  let created = 0, updated = 0;

  for (const product of products) {
    const data = {
      store_id: store.id, woo_id: product.id, name: (product.name as string) || "", slug: (product.slug as string) || "",
      sku: (product.sku as string) || null,
      price: product.price ? parseFloat(product.price as string) : null,
      regular_price: product.regular_price ? parseFloat(product.regular_price as string) : null,
      sale_price: product.sale_price ? parseFloat(product.sale_price as string) : null,
      stock_quantity: (product.stock_quantity as number | null), stock_status: (product.stock_status as string) || "",
      status: (product.status as string) || "", type: (product.type as string) || "",
      description: (product.description as string) || "", short_description: (product.short_description as string) || "",
      categories: toJson(product.categories || []), images: toJson(product.images || []),
      attributes: toJson(product.attributes || []), raw_data: toJson(product), synced_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("products").select("id").eq("store_id", store.id).eq("woo_id", product.id).maybeSingle();
    if (existing) { await supabase.from("products").update(data).eq("id", existing.id); updated++; }
    else { await supabase.from("products").insert(data); created++; }
  }
  await setWatermark(store.id, "products", products.length, startedAt);
  return { processed: products.length, created, updated, isDelta: !!watermark };
}

async function syncOrders(store: StoreToSync): Promise<SyncResult> {
  const watermark = await getWatermark(store.id, "orders");
  const startedAt = new Date().toISOString();
  const orders = await fetchAllFromWooCommerce<WooBase & Record<string, unknown>>(
    store.url, store.consumer_key, store.consumer_secret, "orders", watermark
  );
  let created = 0, updated = 0;

  for (const order of orders) {
    const data = {
      store_id: store.id, woo_id: order.id, order_number: (order.number as string) || "",
      status: (order.status as string) || "", currency: (order.currency as string) || "",
      total: order.total ? parseFloat(order.total as string) : null,
      discount_total: order.discount_total ? parseFloat(order.discount_total as string) : null,
      shipping_total: order.shipping_total ? parseFloat(order.shipping_total as string) : null,
      customer_id: (order.customer_id as number) || null, billing: toJson(order.billing || {}),
      shipping: toJson(order.shipping || {}), line_items: toJson(order.line_items || []),
      shipping_lines: toJson(order.shipping_lines || []), fee_lines: toJson(order.fee_lines || []),
      coupon_lines: toJson(order.coupon_lines || []), raw_data: toJson(order),
      date_created: (order.date_created as string), date_modified: (order.date_modified as string),
      synced_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("orders").select("id").eq("store_id", store.id).eq("woo_id", order.id).maybeSingle();
    if (existing) { await supabase.from("orders").update(data).eq("id", existing.id); updated++; }
    else { await supabase.from("orders").insert(data); created++; }
  }
  await setWatermark(store.id, "orders", orders.length, startedAt);
  return { processed: orders.length, created, updated, isDelta: !!watermark };
}

async function syncCustomers(store: StoreToSync): Promise<SyncResult> {
  const watermark = await getWatermark(store.id, "customers");
  const startedAt = new Date().toISOString();
  const customers = await fetchAllFromWooCommerce<WooBase & Record<string, unknown>>(
    store.url, store.consumer_key, store.consumer_secret, "customers", watermark
  );
  let created = 0, updated = 0;

  for (const customer of customers) {
    const data = {
      store_id: store.id, woo_id: customer.id, email: (customer.email as string) || "",
      first_name: (customer.first_name as string) || "", last_name: (customer.last_name as string) || "",
      username: (customer.username as string) || "", billing: toJson(customer.billing || {}),
      shipping: toJson(customer.shipping || {}), avatar_url: (customer.avatar_url as string) || null,
      is_paying_customer: (customer.is_paying_customer as boolean) || false,
      orders_count: (customer.orders_count as number) || 0,
      total_spent: customer.total_spent ? parseFloat(customer.total_spent as string) : null,
      raw_data: toJson(customer), date_created: (customer.date_created as string),
      synced_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("customers").select("id").eq("store_id", store.id).eq("woo_id", customer.id).maybeSingle();
    if (existing) { await supabase.from("customers").update(data).eq("id", existing.id); updated++; }
    else { await supabase.from("customers").insert(data); created++; }
  }
  await setWatermark(store.id, "customers", customers.length, startedAt);
  return { processed: customers.length, created, updated, isDelta: !!watermark };
}

async function syncCategories(store: StoreToSync): Promise<SyncResult> {
  // Categories don't support modified_after — full fetch each time but they're small
  const startedAt = new Date().toISOString();
  const categories = await fetchAllFromWooCommerce<Record<string, unknown> & { id: number }>(
    store.url, store.consumer_key, store.consumer_secret, "products/categories"
  );
  let created = 0, updated = 0;

  for (const cat of categories) {
    const data = {
      store_id: store.id, woo_id: cat.id, name: (cat.name as string) || "", slug: (cat.slug as string) || "",
      parent_id: (cat.parent as number) || null, description: (cat.description as string) || "",
      display: (cat.display as string) || "", image: toJson(cat.image || null),
      menu_order: (cat.menu_order as number) || 0, count: (cat.count as number) || 0,
      raw_data: toJson(cat), synced_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("categories").select("id").eq("store_id", store.id).eq("woo_id", cat.id).maybeSingle();
    if (existing) { await supabase.from("categories").update(data).eq("id", existing.id); updated++; }
    else { await supabase.from("categories").insert(data); created++; }
  }
  await setWatermark(store.id, "categories", categories.length, startedAt);
  return { processed: categories.length, created, updated, isDelta: false };
}

async function syncTags(store: StoreToSync): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const tags = await fetchAllFromWooCommerce<Record<string, unknown> & { id: number }>(
    store.url, store.consumer_key, store.consumer_secret, "products/tags"
  );
  let created = 0, updated = 0;

  for (const tag of tags) {
    const data = {
      store_id: store.id, woo_id: tag.id, name: (tag.name as string) || "", slug: (tag.slug as string) || "",
      description: (tag.description as string) || "", count: (tag.count as number) || 0,
      raw_data: toJson(tag), synced_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("tags").select("id").eq("store_id", store.id).eq("woo_id", tag.id).maybeSingle();
    if (existing) { await supabase.from("tags").update(data).eq("id", existing.id); updated++; }
    else { await supabase.from("tags").insert(data); created++; }
  }
  await setWatermark(store.id, "tags", tags.length, startedAt);
  return { processed: tags.length, created, updated, isDelta: false };
}

async function syncCoupons(store: StoreToSync): Promise<SyncResult> {
  const startedAt = new Date().toISOString();
  const coupons = await fetchAllFromWooCommerce<Record<string, unknown> & { id: number }>(
    store.url, store.consumer_key, store.consumer_secret, "coupons"
  );
  let created = 0, updated = 0;

  for (const coupon of coupons) {
    try {
      const data = {
        store_id: store.id, woo_id: coupon.id, code: (coupon.code as string) || "",
        amount: coupon.amount ? parseFloat(coupon.amount as string) : null,
        discount_type: (coupon.discount_type as string) || "", description: (coupon.description as string) || "",
        date_expires: (coupon.date_expires as string | null), usage_count: (coupon.usage_count as number) || 0,
        individual_use: (coupon.individual_use as boolean) || false,
        product_ids: toJson(coupon.product_ids || []),
        excluded_product_ids: toJson(coupon.excluded_product_ids || []),
        usage_limit: (coupon.usage_limit as number | null),
        usage_limit_per_user: (coupon.usage_limit_per_user as number | null),
        free_shipping: (coupon.free_shipping as boolean) || false,
        minimum_amount: coupon.minimum_amount ? parseFloat(coupon.minimum_amount as string) : null,
        maximum_amount: coupon.maximum_amount ? parseFloat(coupon.maximum_amount as string) : null,
        raw_data: toJson(coupon), date_created: (coupon.date_created as string),
        synced_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase.from("coupons").select("id").eq("store_id", store.id).eq("woo_id", coupon.id).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("coupons").update(data).eq("id", existing.id);
        if (!error) updated++;
      } else {
        const { error } = await supabase.from("coupons").insert(data);
        if (!error) created++;
      }
    } catch (err) {
      console.error(`[Sync] Coupon exception for ${coupon.code}:`, err);
    }
  }
  await setWatermark(store.id, "coupons", coupons.length, startedAt);
  return { processed: coupons.length, created, updated, isDelta: false };
}

async function ensureWebhooksRegistered(store: StoreToSync): Promise<void> {
  const { data: existingWebhooks } = await supabase.from("webhooks").select("topic, status").eq("store_id", store.id);
  const activeWebhooks = existingWebhooks?.filter(w => w.status === "active") || [];
  const requiredTopics = ["product.created", "product.updated", "product.deleted", "order.created", "order.updated", "customer.created", "customer.updated"];
  const missingTopics = requiredTopics.filter(topic => !activeWebhooks.some(w => w.topic === topic));

  if (missingTopics.length === 0) return;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const deliveryUrl = `${baseUrl}/api/webhooks/incoming/${store.id}`;
  const auth = Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64");

  for (const topic of missingTopics) {
    try {
      const response = await fetch(`${store.url}/wp-json/wc/v3/webhooks`, {
        method: "POST",
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json", "User-Agent": WOO_USER_AGENT },
        body: JSON.stringify({ name: `Proxima - ${topic}`, topic, delivery_url: deliveryUrl, status: "active", secret: `woosync_${store.id}_${Date.now()}` }),
      });
      if (response.ok) {
        const wooWebhook = await response.json();
        await supabase.from("webhooks").upsert({ store_id: store.id, topic, woo_webhook_id: wooWebhook.id, delivery_url: deliveryUrl, status: "active", secret: wooWebhook.secret }, { onConflict: "store_id,topic" });
      } else {
        await supabase.from("webhooks").upsert({ store_id: store.id, topic, delivery_url: deliveryUrl, status: "failed" }, { onConflict: "store_id,topic" });
      }
    } catch (error) {
      console.error(`[Sync] Error registering webhook ${topic}:`, error);
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = new Date().toISOString();

    // Auto-timeout: mark stuck running syncs (>30 min) as failed across all stores
    const stuckThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stuckRuns } = await supabase
      .from("sync_runs")
      .select("id, store_id")
      .eq("status", "running")
      .lt("started_at", stuckThreshold);

    if (stuckRuns && stuckRuns.length > 0) {
      await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          error_message: "Auto-timeout: sync exceeded 30 minute limit",
          completed_at: new Date().toISOString(),
        })
        .in("id", stuckRuns.map(r => r.id));

      const stuckStoreIds = [...new Set(stuckRuns.map(r => r.store_id))];
      for (const sid of stuckStoreIds) {
        const { data: stillRunning } = await supabase
          .from("sync_runs").select("id").eq("store_id", sid).eq("status", "running").limit(1);
        if (!stillRunning?.length) {
          await supabase.from("stores").update({ status: "connected" }).eq("id", sid);
        }
      }
    }

    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("id, name, url, consumer_key, consumer_secret, sync_interval, next_sync_at")
      .not("sync_interval", "is", null)
      .not("consumer_key", "is", null)
      .not("consumer_secret", "is", null)
      .eq("status", "connected")
      .or(`next_sync_at.is.null,next_sync_at.lte.${now}`);

    if (storesError) throw storesError;
    if (!stores || stores.length === 0) {
      return res.status(200).json({ message: "No stores due for sync", checked_at: now, stores_synced: 0 });
    }

    const results = [];
    for (const store of stores as StoreToSync[]) {
      const { data: cronLog } = await supabase.from("cron_logs").insert({ job_type: "scheduled_sync", store_id: store.id, status: "started", message: `Sync started for ${store.name}`, metadata: { sync_interval: store.sync_interval, trigger: "cron" } }).select().single();

      try {
        await ensureWebhooksRegistered(store);
        const syncFunctions: Record<string, (s: StoreToSync) => Promise<SyncResult>> = { products: syncProducts, orders: syncOrders, customers: syncCustomers, categories: syncCategories, tags: syncTags, coupons: syncCoupons };
        let totalRecords = 0, totalCreated = 0, totalUpdated = 0;
        const aspectSummaries: Record<string, { processed: number; isDelta: boolean }> = {};

        for (const [aspect, syncFn] of Object.entries(syncFunctions)) {
          const { data: syncRun } = await supabase.from("sync_runs").insert({ store_id: store.id, aspect, status: "running", started_at: new Date().toISOString() }).select().single();
          try {
            const result = await syncFn(store);
            totalRecords += result.processed;
            totalCreated += result.created;
            totalUpdated += result.updated;
            aspectSummaries[aspect] = { processed: result.processed, isDelta: result.isDelta };
            if (syncRun) await supabase.from("sync_runs").update({
              status: "completed",
              completed_at: new Date().toISOString(),
              records_processed: result.processed,
              records_created: result.created,
              records_updated: result.updated,
            }).eq("id", syncRun.id);
          } catch (aspectError) {
            if (syncRun) {
              const errMsg = aspectError instanceof Error ? aspectError.message : "Unknown error";
              const statusMatch = /(\d{3})/.exec(errMsg);
              const httpStatus = statusMatch ? parseInt(statusMatch[1], 10) : undefined;
              const errName = aspectError instanceof Error ? aspectError.name : undefined;
              const attempt = syncRun.attempt || 1;
              const canRetry = isRetryableError(httpStatus, errName) && attempt < MAX_SYNC_ATTEMPTS;
              const delay = canRetry ? nextRetryDelaySeconds(attempt) : null;
              const requestUrl = `${store.url.replace(/\/$/, "")}/wp-json/wc/v3/${aspect === "categories" ? "products/categories" : aspect === "tags" ? "products/tags" : aspect}`;

              await supabase.from("sync_runs").update({
                status: canRetry ? "retrying" : "failed",
                completed_at: canRetry ? null : new Date().toISOString(),
                error_message: errMsg,
                request_url: requestUrl,
                request_method: "GET",
                response_status: httpStatus || null,
                next_retry_at: canRetry && delay ? new Date(Date.now() + delay * 1000).toISOString() : null,
              }).eq("id", syncRun.id);
            }
          }
        }

        const nextSyncAt = new Date();
        nextSyncAt.setMinutes(nextSyncAt.getMinutes() + (store.sync_interval || 60));
        await supabase.from("stores").update({ last_sync_at: new Date().toISOString(), next_sync_at: nextSyncAt.toISOString() }).eq("id", store.id);
        if (cronLog) await supabase.from("cron_logs").update({
          status: "completed",
          message: `Sync completed. ${totalRecords} records (${totalCreated} created, ${totalUpdated} updated).`,
          completed_at: new Date().toISOString(),
          metadata: {
            records_processed: totalRecords,
            records_created: totalCreated,
            records_updated: totalUpdated,
            next_sync_at: nextSyncAt.toISOString(),
            aspects: aspectSummaries,
          },
        }).eq("id", cronLog.id);
        results.push({ store_id: store.id, store_name: store.name, status: "completed", records_processed: totalRecords, records_created: totalCreated, records_updated: totalUpdated, next_sync_at: nextSyncAt.toISOString(), aspects: aspectSummaries });
      } catch (syncError) {
        if (cronLog) await supabase.from("cron_logs").update({ status: "failed", error_message: syncError instanceof Error ? syncError.message : "Unknown error", completed_at: new Date().toISOString() }).eq("id", cronLog.id);
        results.push({ store_id: store.id, store_name: store.name, status: "failed", error: syncError instanceof Error ? syncError.message : "Unknown error" });
      }
    }

    return res.status(200).json({ message: "Sync completed", checked_at: now, stores_synced: results.length, results });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" });
  }
}