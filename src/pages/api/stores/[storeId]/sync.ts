import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/database.types";

interface StoreToSync {
  id: string;
  name: string;
  url: string;
  consumer_key: string;
  consumer_secret: string;
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
  endpoint: string,
  params: Record<string, string> = {}
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
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 404) {
        break;
      }
      throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
    }

    const items: T[] = await response.json();
    
    if (items.length === 0) {
      hasMore = false;
    } else {
      allItems.push(...items);
      if (items.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }

    if (page > 50) {
      hasMore = false;
    }
  }

  return allItems;
}

async function syncProducts(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const products = await fetchAllFromWooCommerce<WooProduct>(
    store.url, store.consumer_key, store.consumer_secret, "products"
  );

  let created = 0, updated = 0;

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

    const { data: existing } = await supabase
      .from("products").select("id").eq("store_id", store.id).eq("woo_id", product.id).single();

    if (existing) {
      await supabase.from("products").update(productData).eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("products").insert(productData);
      created++;
    }
  }

  return { processed: products.length, created, updated };
}

async function syncOrders(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const orders = await fetchAllFromWooCommerce<WooOrder>(
    store.url, store.consumer_key, store.consumer_secret, "orders"
  );

  let created = 0, updated = 0;

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
      .from("orders").select("id").eq("store_id", store.id).eq("woo_id", order.id).single();

    if (existing) {
      await supabase.from("orders").update(orderData).eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("orders").insert(orderData);
      created++;
    }
  }

  return { processed: orders.length, created, updated };
}

async function syncCustomers(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const customers = await fetchAllFromWooCommerce<WooCustomer>(
    store.url, store.consumer_key, store.consumer_secret, "customers"
  );

  let created = 0, updated = 0;

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
      .from("customers").select("id").eq("store_id", store.id).eq("woo_id", customer.id).single();

    if (existing) {
      await supabase.from("customers").update(customerData).eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("customers").insert(customerData);
      created++;
    }
  }

  return { processed: customers.length, created, updated };
}

async function syncCategories(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const categories = await fetchAllFromWooCommerce<WooCategory>(
    store.url, store.consumer_key, store.consumer_secret, "products/categories"
  );

  let created = 0, updated = 0;

  for (const category of categories) {
    const categoryData = {
      store_id: store.id,
      woo_id: category.id,
      name: category.name,
      slug: category.slug,
      parent_id: category.parent || null,
      description: category.description,
      display: category.display,
      image: toJson(category.image),
      menu_order: category.menu_order,
      count: category.count,
      raw_data: toJson(category),
      synced_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("categories").select("id").eq("store_id", store.id).eq("woo_id", category.id).single();

    if (existing) {
      await supabase.from("categories").update(categoryData).eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("categories").insert(categoryData);
      created++;
    }
  }

  return { processed: categories.length, created, updated };
}

async function syncCoupons(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const coupons = await fetchAllFromWooCommerce<WooCoupon>(
    store.url, store.consumer_key, store.consumer_secret, "coupons"
  );

  let created = 0, updated = 0;

  for (const coupon of coupons) {
    const couponData = {
      store_id: store.id,
      woo_id: coupon.id,
      code: coupon.code,
      amount: coupon.amount ? parseFloat(coupon.amount) : null,
      discount_type: coupon.discount_type,
      description: coupon.description,
      date_expires: coupon.date_expires,
      usage_count: coupon.usage_count || 0,
      individual_use: coupon.individual_use || false,
      product_ids: toJson(coupon.product_ids || []),
      excluded_product_ids: toJson(coupon.excluded_product_ids || []),
      usage_limit: coupon.usage_limit,
      usage_limit_per_user: coupon.usage_limit_per_user,
      free_shipping: coupon.free_shipping || false,
      minimum_amount: coupon.minimum_amount ? parseFloat(coupon.minimum_amount) : null,
      maximum_amount: coupon.maximum_amount ? parseFloat(coupon.maximum_amount) : null,
      raw_data: toJson(coupon),
      date_created: coupon.date_created,
      synced_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("coupons").select("id").eq("store_id", store.id).eq("woo_id", coupon.id).single();

    if (existing) {
      await supabase.from("coupons").update(couponData).eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("coupons").insert(couponData);
      created++;
    }
  }

  return { processed: coupons.length, created, updated };
}

async function syncTags(store: StoreToSync): Promise<{ processed: number; created: number; updated: number }> {
  const tags = await fetchAllFromWooCommerce<WooTag>(
    store.url, store.consumer_key, store.consumer_secret, "products/tags"
  );

  let created = 0, updated = 0;

  for (const tag of tags) {
    const tagData = {
      store_id: store.id,
      woo_id: tag.id,
      name: tag.name,
      slug: tag.slug,
      description: tag.description || "",
      count: tag.count || 0,
      raw_data: toJson(tag),
      synced_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("tags").select("id").eq("store_id", store.id).eq("woo_id", tag.id).maybeSingle();

    if (existing) {
      await supabase.from("tags").update(tagData).eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("tags").insert(tagData);
      created++;
    }
  }

  return { processed: tags.length, created, updated };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId } = req.query;
  const { aspect } = req.body || {};

  if (!storeId || typeof storeId !== "string") {
    return res.status(400).json({ error: "Store ID required" });
  }

  try {
    // Get store details
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

    // Update store status to syncing
    await supabase.from("stores").update({ status: "syncing" }).eq("id", storeId);

    const syncFunctions: Record<string, (s: StoreToSync) => Promise<{ processed: number; created: number; updated: number }>> = {
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
      // Create sync run record
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

      try {
        const result = await syncFunctions[asp](store as StoreToSync);
        results[asp] = result;
        totalProcessed += result.processed;
        totalCreated += result.created;
        totalUpdated += result.updated;

        // Update sync run as completed
        if (syncRun) {
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
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        results[asp] = { processed: 0, created: 0, updated: 0, error: errorMsg };

        if (syncRun) {
          await supabase
            .from("sync_runs")
            .update({
              status: "failed",
              completed_at: new Date().toISOString(),
              error_message: errorMsg,
            })
            .eq("id", syncRun.id);
        }
      }
    }

    // Update store status and last_sync_at
    await supabase
      .from("stores")
      .update({
        status: "connected",
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", storeId);

    return res.status(200).json({
      success: true,
      store_id: storeId,
      results,
      totals: {
        processed: totalProcessed,
        created: totalCreated,
        updated: totalUpdated,
      },
    });

  } catch (error) {
    console.error("[Sync API] Error:", error);
    
    // Reset store status
    await supabase.from("stores").update({ status: "error" }).eq("id", storeId);

    return res.status(500).json({
      error: "Sync failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}