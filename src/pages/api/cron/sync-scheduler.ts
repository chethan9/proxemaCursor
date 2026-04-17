import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/database.types";

// Vercel Cron job - runs every minute to check for stores needing sync
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/sync-scheduler", "schedule": "* * * * *" }] }

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

// Helper to convert objects to Json type safely
function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

async function fetchFromWooCommerce<T>(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const url = new URL(`${storeUrl}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.set("per_page", "100");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  
  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function syncProducts(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const products = await fetchFromWooCommerce<WooProduct>(
    store.url,
    store.consumer_key,
    store.consumer_secret,
    "products"
  );

  let created = 0;
  let updated = 0;

  for (const product of products) {
    const productData = {
      store_id: store.id,
      woo_id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku || null,
      price: product.price ? parseFloat(product.price) : null,
      regular_price: product.regular_price ? parseFloat(product.regular_price) : null,
      sale_price: product.sale_price ? parseFloat(product.sale_price) : null,
      stock_quantity: product.stock_quantity,
      stock_status: product.stock_status,
      status: product.status,
      type: product.type,
      description: product.description,
      short_description: product.short_description,
      categories: toJson(product.categories),
      images: toJson(product.images),
      attributes: toJson(product.attributes || []),
      raw_data: toJson(product),
      synced_at: new Date().toISOString(),
    };

    // Upsert - check if exists first
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("store_id", store.id)
      .eq("woo_id", product.id)
      .single();

    if (existing) {
      await supabase
        .from("products")
        .update(productData)
        .eq("id", existing.id);
      updated++;
    } else {
      await supabase
        .from("products")
        .insert(productData);
      created++;
    }
  }

  return { processed: products.length, created, updated };
}

async function syncOrders(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const orders = await fetchFromWooCommerce<WooOrder>(
    store.url,
    store.consumer_key,
    store.consumer_secret,
    "orders"
  );

  let created = 0;
  let updated = 0;

  for (const order of orders) {
    const orderData = {
      store_id: store.id,
      woo_id: order.id,
      order_number: order.number,
      status: order.status,
      currency: order.currency,
      total: order.total ? parseFloat(order.total) : null,
      discount_total: order.discount_total ? parseFloat(order.discount_total) : null,
      shipping_total: order.shipping_total ? parseFloat(order.shipping_total) : null,
      customer_id: order.customer_id || null,
      billing: toJson(order.billing),
      shipping: toJson(order.shipping),
      line_items: toJson(order.line_items),
      shipping_lines: toJson(order.shipping_lines || []),
      fee_lines: toJson(order.fee_lines || []),
      coupon_lines: toJson(order.coupon_lines || []),
      raw_data: toJson(order),
      date_created: order.date_created,
      date_modified: order.date_modified,
      synced_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("store_id", store.id)
      .eq("woo_id", order.id)
      .single();

    if (existing) {
      await supabase
        .from("orders")
        .update(orderData)
        .eq("id", existing.id);
      updated++;
    } else {
      await supabase
        .from("orders")
        .insert(orderData);
      created++;
    }
  }

  return { processed: orders.length, created, updated };
}

async function syncCustomers(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const customers = await fetchFromWooCommerce<WooCustomer>(
    store.url,
    store.consumer_key,
    store.consumer_secret,
    "customers"
  );

  let created = 0;
  let updated = 0;

  for (const customer of customers) {
    const customerData = {
      store_id: store.id,
      woo_id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      username: customer.username,
      billing: toJson(customer.billing),
      shipping: toJson(customer.shipping),
      avatar_url: customer.avatar_url || null,
      is_paying_customer: customer.is_paying_customer || false,
      orders_count: customer.orders_count || 0,
      total_spent: customer.total_spent ? parseFloat(customer.total_spent) : null,
      raw_data: toJson(customer),
      date_created: customer.date_created,
      synced_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("store_id", store.id)
      .eq("woo_id", customer.id)
      .single();

    if (existing) {
      await supabase
        .from("customers")
        .update(customerData)
        .eq("id", existing.id);
      updated++;
    } else {
      await supabase
        .from("customers")
        .insert(customerData);
      created++;
    }
  }

  return { processed: customers.length, created, updated };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify cron secret for security (Vercel sets this header)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  // In production, verify the cron secret
  if (process.env.NODE_ENV === "production" && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log("[Cron] Unauthorized request");
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  console.log("[Cron] Sync scheduler started at", new Date().toISOString());

  try {
    // Find all stores with sync_interval set and next_sync_at in the past (or null)
    const now = new Date().toISOString();
    
    const { data: stores, error: storesError } = await supabase
      .from("stores")
      .select("id, name, url, consumer_key, consumer_secret, sync_interval, next_sync_at")
      .not("sync_interval", "is", null)
      .not("consumer_key", "is", null)
      .not("consumer_secret", "is", null)
      .eq("status", "connected")
      .or(`next_sync_at.is.null,next_sync_at.lte.${now}`);

    if (storesError) {
      console.error("[Cron] Error fetching stores:", storesError);
      throw storesError;
    }

    if (!stores || stores.length === 0) {
      console.log("[Cron] No stores due for sync");
      return res.status(200).json({ 
        message: "No stores due for sync",
        checked_at: now,
        stores_synced: 0 
      });
    }

    console.log(`[Cron] Found ${stores.length} store(s) due for sync`);

    const results = [];

    for (const store of stores as StoreToSync[]) {
      // Create cron log entry
      const { data: cronLog, error: logError } = await supabase
        .from("cron_logs")
        .insert({
          job_type: "scheduled_sync",
          store_id: store.id,
          status: "started",
          message: `Scheduled sync started for ${store.name}`,
          metadata: { 
            sync_interval: store.sync_interval,
            trigger: "cron"
          }
        })
        .select()
        .single();

      if (logError) {
        console.error("[Cron] Error creating log:", logError);
      }

      try {
        const syncFunctions: Record<string, (s: StoreToSync) => Promise<{ processed: number; created: number; updated: number }>> = {
          products: syncProducts,
          orders: syncOrders,
          customers: syncCustomers,
        };

        let totalRecords = 0;
        let totalCreated = 0;
        let totalUpdated = 0;

        for (const [aspect, syncFn] of Object.entries(syncFunctions)) {
          // Create sync run record
          const { data: syncRun, error: syncError } = await supabase
            .from("sync_runs")
            .insert({
              store_id: store.id,
              aspect,
              status: "running",
              started_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (syncError) {
            console.error(`[Cron] Error creating sync run for ${aspect}:`, syncError);
            continue;
          }

          try {
            // Actually sync the data
            const result = await syncFn(store);
            totalRecords += result.processed;
            totalCreated += result.created;
            totalUpdated += result.updated;

            // Update sync run as completed
            await supabase
              .from("sync_runs")
              .update({
                status: "completed",
                completed_at: new Date().toISOString(),
                records_processed: result.processed,
                records_created: result.created,
                records_updated: result.updated,
              })
              .eq("id", syncRun.id);

            console.log(`[Cron] Synced ${aspect} for ${store.name}: ${result.processed} processed, ${result.created} created, ${result.updated} updated`);

          } catch (aspectError) {
            console.error(`[Cron] Error syncing ${aspect} for ${store.name}:`, aspectError);
            
            await supabase
              .from("sync_runs")
              .update({
                status: "failed",
                completed_at: new Date().toISOString(),
                error_message: aspectError instanceof Error ? aspectError.message : "Unknown error",
              })
              .eq("id", syncRun.id);
          }
        }

        // Calculate next sync time
        const nextSyncAt = new Date();
        nextSyncAt.setMinutes(nextSyncAt.getMinutes() + (store.sync_interval || 60));

        // Update store's next_sync_at and last_sync_at
        await supabase
          .from("stores")
          .update({
            last_sync_at: new Date().toISOString(),
            next_sync_at: nextSyncAt.toISOString(),
          })
          .eq("id", store.id);

        // Update cron log as completed
        if (cronLog) {
          await supabase
            .from("cron_logs")
            .update({
              status: "completed",
              message: `Scheduled sync completed for ${store.name}. Processed ${totalRecords} records (${totalCreated} created, ${totalUpdated} updated).`,
              completed_at: new Date().toISOString(),
              metadata: {
                sync_interval: store.sync_interval,
                trigger: "cron",
                records_processed: totalRecords,
                records_created: totalCreated,
                records_updated: totalUpdated,
                next_sync_at: nextSyncAt.toISOString()
              }
            })
            .eq("id", cronLog.id);
        }

        results.push({
          store_id: store.id,
          store_name: store.name,
          status: "completed",
          records_processed: totalRecords,
          records_created: totalCreated,
          records_updated: totalUpdated,
          next_sync_at: nextSyncAt.toISOString()
        });

        console.log(`[Cron] Completed sync for ${store.name}, next sync at ${nextSyncAt.toISOString()}`);

      } catch (syncError) {
        console.error(`[Cron] Error syncing store ${store.name}:`, syncError);

        // Update cron log as failed
        if (cronLog) {
          await supabase
            .from("cron_logs")
            .update({
              status: "failed",
              error_message: syncError instanceof Error ? syncError.message : "Unknown error",
              completed_at: new Date().toISOString(),
            })
            .eq("id", cronLog.id);
        }

        results.push({
          store_id: store.id,
          store_name: store.name,
          status: "failed",
          error: syncError instanceof Error ? syncError.message : "Unknown error"
        });
      }
    }

    console.log("[Cron] Sync scheduler completed", results);

    return res.status(200).json({
      message: "Sync scheduler completed",
      checked_at: now,
      stores_synced: results.length,
      results
    });

  } catch (error) {
    console.error("[Cron] Sync scheduler error:", error);
    
    // Log the error
    await supabase
      .from("cron_logs")
      .insert({
        job_type: "scheduled_sync",
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        message: "Sync scheduler failed",
      });

    return res.status(500).json({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}