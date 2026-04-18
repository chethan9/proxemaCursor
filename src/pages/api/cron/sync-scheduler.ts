import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/database.types";

interface StoreToSync {
  id: string;
  name: string;
  url: string;
  consumer_key: string;
  consumer_secret: string;
  sync_interval: number;
  next_sync_at: string | null;
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
  categories: Array<{ id: number; name: string; slug: string }>;
  images: Array<{ id: number; src: string; name: string; alt: string }>;
  attributes: Array<{ id: number; name: string; options: string[] }>;
  date_created: string;
  date_modified: string;
}

interface WooOrder {
  id: number;
  number: string;
  status: string;
  currency: string;
  total: string;
  discount_total: string;
  shipping_total: string;
  customer_id: number;
  billing: Record<string, unknown>;
  shipping: Record<string, unknown>;
  line_items: Array<Record<string, unknown>>;
  shipping_lines: Array<Record<string, unknown>>;
  fee_lines: Array<Record<string, unknown>>;
  coupon_lines: Array<Record<string, unknown>>;
  date_created: string;
  date_modified: string;
}

interface WooCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  billing: Record<string, unknown>;
  shipping: Record<string, unknown>;
  avatar_url: string;
  is_paying_customer: boolean;
  orders_count: number;
  total_spent: string;
  date_created: string;
  date_modified: string;
}

interface WooCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  description: string;
  display: string;
  image: { id: number; src: string; name: string; alt: string } | null;
  menu_order: number;
  count: number;
}

interface WooCoupon {
  id: number;
  code: string;
  amount: string;
  discount_type: string;
  description: string;
  date_expires: string | null;
  usage_count: number;
  individual_use: boolean;
  product_ids: number[];
  excluded_product_ids: number[];
  usage_limit: number | null;
  usage_limit_per_user: number | null;
  free_shipping: boolean;
  minimum_amount: string;
  maximum_amount: string;
  date_created: string;
  date_modified: string;
}

interface WooTag {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
}

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

async function fetchAllFromWooCommerce<T>(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  endpoint: string
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
    if (page > 50) hasMore = false;
  }
  return allItems;
}

async function syncProducts(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const products = await fetchAllFromWooCommerce<WooProduct>(store.url, store.consumer_key, store.consumer_secret, "products");
  let created = 0, updated = 0;

  for (const product of products) {
    const data = {
      store_id: store.id, woo_id: product.id, name: product.name, slug: product.slug,
      sku: product.sku || null, price: product.price ? parseFloat(product.price) : null,
      regular_price: product.regular_price ? parseFloat(product.regular_price) : null,
      sale_price: product.sale_price ? parseFloat(product.sale_price) : null,
      stock_quantity: product.stock_quantity, stock_status: product.stock_status,
      status: product.status, type: product.type, description: product.description,
      short_description: product.short_description, categories: toJson(product.categories),
      images: toJson(product.images), attributes: toJson(product.attributes || []),
      raw_data: toJson(product), synced_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("products").select("id").eq("store_id", store.id).eq("woo_id", product.id).single();
    if (existing) { await supabase.from("products").update(data).eq("id", existing.id); updated++; }
    else { await supabase.from("products").insert(data); created++; }
  }
  return { processed: products.length, created, updated };
}

async function syncOrders(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const orders = await fetchAllFromWooCommerce<WooOrder>(store.url, store.consumer_key, store.consumer_secret, "orders");
  let created = 0, updated = 0;

  for (const order of orders) {
    const data = {
      store_id: store.id, woo_id: order.id, order_number: order.number, status: order.status,
      currency: order.currency, total: order.total ? parseFloat(order.total) : null,
      discount_total: order.discount_total ? parseFloat(order.discount_total) : null,
      shipping_total: order.shipping_total ? parseFloat(order.shipping_total) : null,
      customer_id: order.customer_id || null, billing: toJson(order.billing),
      shipping: toJson(order.shipping), line_items: toJson(order.line_items),
      shipping_lines: toJson(order.shipping_lines || []), fee_lines: toJson(order.fee_lines || []),
      coupon_lines: toJson(order.coupon_lines || []), raw_data: toJson(order),
      date_created: order.date_created, date_modified: order.date_modified,
      synced_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("orders").select("id").eq("store_id", store.id).eq("woo_id", order.id).single();
    if (existing) { await supabase.from("orders").update(data).eq("id", existing.id); updated++; }
    else { await supabase.from("orders").insert(data); created++; }
  }
  return { processed: orders.length, created, updated };
}

async function syncCustomers(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const customers = await fetchAllFromWooCommerce<WooCustomer>(store.url, store.consumer_key, store.consumer_secret, "customers");
  let created = 0, updated = 0;

  for (const customer of customers) {
    const data = {
      store_id: store.id, woo_id: customer.id, email: customer.email,
      first_name: customer.first_name, last_name: customer.last_name,
      username: customer.username, billing: toJson(customer.billing),
      shipping: toJson(customer.shipping), avatar_url: customer.avatar_url || null,
      is_paying_customer: customer.is_paying_customer || false,
      orders_count: customer.orders_count || 0,
      total_spent: customer.total_spent ? parseFloat(customer.total_spent) : null,
      raw_data: toJson(customer), date_created: customer.date_created,
      synced_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("customers").select("id").eq("store_id", store.id).eq("woo_id", customer.id).single();
    if (existing) { await supabase.from("customers").update(data).eq("id", existing.id); updated++; }
    else { await supabase.from("customers").insert(data); created++; }
  }
  return { processed: customers.length, created, updated };
}

async function syncCategories(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const categories = await fetchAllFromWooCommerce<WooCategory>(store.url, store.consumer_key, store.consumer_secret, "products/categories");
  let created = 0, updated = 0;

  for (const cat of categories) {
    const data = {
      store_id: store.id, woo_id: cat.id, name: cat.name, slug: cat.slug,
      parent_id: cat.parent || null, description: cat.description, display: cat.display,
      image: toJson(cat.image), menu_order: cat.menu_order, count: cat.count,
      raw_data: toJson(cat), synced_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("categories").select("id").eq("store_id", store.id).eq("woo_id", cat.id).single();
    if (existing) { await supabase.from("categories").update(data).eq("id", existing.id); updated++; }
    else { await supabase.from("categories").insert(data); created++; }
  }
  return { processed: categories.length, created, updated };
}

async function syncTags(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const tags = await fetchAllFromWooCommerce<WooTag>(store.url, store.consumer_key, store.consumer_secret, "products/tags");
  let created = 0, updated = 0;

  for (const tag of tags) {
    const data = {
      store_id: store.id, woo_id: tag.id, name: tag.name, slug: tag.slug,
      description: tag.description || "", count: tag.count || 0,
      raw_data: toJson(tag), synced_at: new Date().toISOString(),
    };
    const { data: existing } = await supabase.from("tags").select("id").eq("store_id", store.id).eq("woo_id", tag.id).maybeSingle();
    if (existing) { await supabase.from("tags").update(data).eq("id", existing.id); updated++; }
    else { await supabase.from("tags").insert(data); created++; }
  }
  return { processed: tags.length, created, updated };
}

async function syncCoupons(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const coupons = await fetchAllFromWooCommerce<WooCoupon>(store.url, store.consumer_key, store.consumer_secret, "coupons");
  console.log(`[Sync] Fetched ${coupons.length} coupons for ${store.name}`);
  let created = 0, updated = 0;

  for (const coupon of coupons) {
    try {
      const data = {
        store_id: store.id, woo_id: coupon.id, code: coupon.code,
        amount: coupon.amount ? parseFloat(coupon.amount) : null,
        discount_type: coupon.discount_type, description: coupon.description || "",
        date_expires: coupon.date_expires, usage_count: coupon.usage_count || 0,
        individual_use: coupon.individual_use || false,
        product_ids: toJson(coupon.product_ids || []),
        excluded_product_ids: toJson(coupon.excluded_product_ids || []),
        usage_limit: coupon.usage_limit, usage_limit_per_user: coupon.usage_limit_per_user,
        free_shipping: coupon.free_shipping || false,
        minimum_amount: coupon.minimum_amount ? parseFloat(coupon.minimum_amount) : null,
        maximum_amount: coupon.maximum_amount ? parseFloat(coupon.maximum_amount) : null,
        raw_data: toJson(coupon), date_created: coupon.date_created,
        synced_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase.from("coupons").select("id").eq("store_id", store.id).eq("woo_id", coupon.id).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("coupons").update(data).eq("id", existing.id);
        if (error) console.error(`[Sync] Coupon update error for ${coupon.code}:`, error.message);
        else updated++;
      } else {
        const { error } = await supabase.from("coupons").insert(data);
        if (error) console.error(`[Sync] Coupon insert error for ${coupon.code}:`, error.message);
        else created++;
      }
    } catch (err) {
      console.error(`[Sync] Coupon exception for ${coupon.code}:`, err);
    }
  }
  return { processed: coupons.length, created, updated };
}

async function ensureWebhooksRegistered(store: StoreToSync): Promise<void> {
  const { data: existingWebhooks } = await supabase.from("webhooks").select("topic, status").eq("store_id", store.id);
  const activeWebhooks = existingWebhooks?.filter(w => w.status === "active") || [];
  const requiredTopics = ["product.created", "product.updated", "product.deleted", "order.created", "order.updated", "customer.created", "customer.updated"];
  const missingTopics = requiredTopics.filter(topic => !activeWebhooks.some(w => w.topic === topic));

  if (missingTopics.length === 0) return;

  // Build the webhook delivery URL
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const deliveryUrl = `${baseUrl}/api/webhooks/incoming/${store.id}`;
  const auth = Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64");

  for (const topic of missingTopics) {
    try {
      const response = await fetch(`${store.url}/wp-json/wc/v3/webhooks`, {
        method: "POST",
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: `WooSync - ${topic}`, topic, delivery_url: deliveryUrl, status: "active", secret: `woosync_${store.id}_${Date.now()}` }),
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

    // Auto-timeout: mark stuck running syncs (>10 min) as failed across all stores
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckRuns } = await supabase
      .from("sync_runs")
      .select("id, store_id")
      .eq("status", "running")
      .lt("started_at", tenMinAgo);

    if (stuckRuns && stuckRuns.length > 0) {
      await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          error_message: "Auto-timeout: sync exceeded 10 minute limit",
          completed_at: new Date().toISOString(),
        })
        .in("id", stuckRuns.map(r => r.id));

      const stuckStoreIds = [...new Set(stuckRuns.map(r => r.store_id))];
      for (const sid of stuckStoreIds) {
        const { data: stillRunning } = await supabase
          .from("sync_runs")
          .select("id")
          .eq("store_id", sid)
          .eq("status", "running")
          .limit(1);
        if (!stillRunning?.length) {
          await supabase.from("stores").update({ status: "connected" }).eq("id", sid);
        }
      }
      console.log(`[Cron] Auto-timed-out ${stuckRuns.length} stuck sync runs`);
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
        const syncFunctions: Record<string, (s: StoreToSync) => Promise<{ processed: number; created: number; updated: number }>> = { products: syncProducts, orders: syncOrders, customers: syncCustomers, categories: syncCategories, tags: syncTags, coupons: syncCoupons };
        let totalRecords = 0, totalCreated = 0, totalUpdated = 0;

        for (const [aspect, syncFn] of Object.entries(syncFunctions)) {
          const { data: syncRun } = await supabase.from("sync_runs").insert({ store_id: store.id, aspect, status: "running", started_at: new Date().toISOString() }).select().single();
          try {
            const result = await syncFn(store);
            totalRecords += result.processed;
            totalCreated += result.created;
            totalUpdated += result.updated;
            if (syncRun) await supabase.from("sync_runs").update({ status: "completed", completed_at: new Date().toISOString(), records_processed: result.processed, records_created: result.created, records_updated: result.updated }).eq("id", syncRun.id);
          } catch (aspectError) {
            if (syncRun) await supabase.from("sync_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: aspectError instanceof Error ? aspectError.message : "Unknown error" }).eq("id", syncRun.id);
          }
        }

        const nextSyncAt = new Date();
        nextSyncAt.setMinutes(nextSyncAt.getMinutes() + (store.sync_interval || 60));
        await supabase.from("stores").update({ last_sync_at: new Date().toISOString(), next_sync_at: nextSyncAt.toISOString() }).eq("id", store.id);
        if (cronLog) await supabase.from("cron_logs").update({ status: "completed", message: `Sync completed. ${totalRecords} records (${totalCreated} created, ${totalUpdated} updated).`, completed_at: new Date().toISOString(), metadata: { records_processed: totalRecords, records_created: totalCreated, records_updated: totalUpdated, next_sync_at: nextSyncAt.toISOString() } }).eq("id", cronLog.id);
        results.push({ store_id: store.id, store_name: store.name, status: "completed", records_processed: totalRecords, records_created: totalCreated, records_updated: totalUpdated, next_sync_at: nextSyncAt.toISOString() });
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