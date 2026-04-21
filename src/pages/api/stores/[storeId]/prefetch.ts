import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { WOO_USER_AGENT } from "@/lib/sync-error";
import type { Json } from "@/integrations/supabase/database.types";

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

async function fetchWoo<T>(storeUrl: string, auth: string, endpoint: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`${storeUrl.replace(/\/$/, "")}/wp-json/wc/v3/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Basic ${auth}`, "User-Agent": WOO_USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    clearTimeout(t);
    return [];
  }
}

async function upsertProducts(storeId: string, items: Record<string, unknown>[]) {
  if (items.length === 0) return;
  const now = new Date().toISOString();
  const rows = items.map((p) => ({
    store_id: storeId,
    woo_id: p.id as number,
    name: p.name as string,
    slug: p.slug as string,
    sku: (p.sku as string) || null,
    price: p.price ? parseFloat(p.price as string) : null,
    regular_price: p.regular_price ? parseFloat(p.regular_price as string) : null,
    sale_price: p.sale_price ? parseFloat(p.sale_price as string) : null,
    stock_quantity: p.stock_quantity as number | null,
    stock_status: p.stock_status as string,
    status: p.status as string,
    type: p.type as string,
    description: (p.description as string) || "",
    short_description: (p.short_description as string) || "",
    categories: toJson(p.categories || []),
    images: toJson(p.images || []),
    attributes: toJson(p.attributes || []),
    raw_data: toJson(p),
    synced_at: now,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any).from("products").upsert(rows, { onConflict: "store_id,woo_id" });
}

async function upsertOrders(storeId: string, items: Record<string, unknown>[]) {
  if (items.length === 0) return;
  const now = new Date().toISOString();
  const rows = items.map((o) => ({
    store_id: storeId,
    woo_id: o.id as number,
    order_number: o.number as string,
    status: o.status as string,
    currency: o.currency as string,
    total: o.total ? parseFloat(o.total as string) : null,
    discount_total: o.discount_total ? parseFloat(o.discount_total as string) : null,
    shipping_total: o.shipping_total ? parseFloat(o.shipping_total as string) : null,
    customer_id: (o.customer_id as number) || null,
    payment_method: (o.payment_method as string) || null,
    payment_method_title: (o.payment_method_title as string) || null,
    billing: toJson(o.billing || {}),
    shipping: toJson(o.shipping || {}),
    line_items: toJson(o.line_items || []),
    shipping_lines: toJson(o.shipping_lines || []),
    fee_lines: toJson(o.fee_lines || []),
    coupon_lines: toJson(o.coupon_lines || []),
    raw_data: toJson(o),
    date_created: o.date_created as string,
    date_modified: o.date_modified as string,
    synced_at: now,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any).from("orders").upsert(rows, { onConflict: "store_id,woo_id" });
}

async function upsertCategories(storeId: string, items: Record<string, unknown>[]) {
  if (items.length === 0) return;
  const now = new Date().toISOString();
  const rows = items.map((c) => ({
    store_id: storeId,
    woo_id: c.id as number,
    name: c.name as string,
    slug: c.slug as string,
    parent_id: (c.parent as number) || null,
    description: (c.description as string) || "",
    display: (c.display as string) || "default",
    image: toJson(c.image),
    menu_order: (c.menu_order as number) || 0,
    count: (c.count as number) || 0,
    raw_data: toJson(c),
    synced_at: now,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any).from("categories").upsert(rows, { onConflict: "store_id,woo_id" });
}

async function fetchAllCategories(storeUrl: string, auth: string): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let page = 1;
  while (page <= 20) {
    const chunk = await fetchWoo<Record<string, unknown>>(storeUrl, auth, "products/categories", { per_page: "100", page: String(page) });
    if (chunk.length === 0) break;
    all.push(...chunk);
    if (chunk.length < 100) break;
    page++;
  }
  return all;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { storeId } = req.query;
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });

  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("id, url, consumer_key, consumer_secret, onboarding_completed_at")
    .eq("id", storeId)
    .maybeSingle();

  if (!store || !store.consumer_key || !store.consumer_secret) {
    return res.status(400).json({ error: "Store not ready" });
  }

  // Respond quickly so the client can redirect; continue work in background
  res.status(202).json({ queued: true });

  const runBackground = async () => {
    const auth = Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64");

    // Phase 1: prefetch top 50 products, 50 orders, all categories in parallel
    const [products, orders, categories] = await Promise.all([
      fetchWoo<Record<string, unknown>>(store.url, auth, "products", { per_page: "50", page: "1", orderby: "modified", order: "desc" }),
      fetchWoo<Record<string, unknown>>(store.url, auth, "orders", { per_page: "50", page: "1", orderby: "date", order: "desc" }),
      fetchAllCategories(store.url, auth),
    ]);

    await Promise.all([
      upsertProducts(storeId, products),
      upsertOrders(storeId, orders),
      upsertCategories(storeId, categories),
    ]);

    // Stamp onboarding complete
    if (!store.onboarding_completed_at) {
      await supabaseAdmin
        .from("stores")
        .update({ onboarding_completed_at: new Date().toISOString() } as never)
        .eq("id", storeId)
        .is("onboarding_completed_at", null);
    }

    // Phase 2: kick off full background sync to fill remaining data
    const { data: run } = await supabaseAdmin
      .from("sync_runs")
      .insert({
        store_id: storeId,
        aspect: "all",
        status: "running",
        started_at: new Date().toISOString(),
        is_initial: true,
        estimated_total: 0,
        processed_total: 0,
      } as never)
      .select()
      .single();

    const base = getAppUrl(req);
    fetch(`${base}/api/stores/${storeId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch((e) => console.error("[prefetch->sync]", e));

    console.log(`[prefetch] ${storeId}: ${products.length}p/${orders.length}o/${categories.length}c prefetched, full sync run ${run?.id} started`);
  };

  runBackground().catch((e) => console.error("[prefetch] bg error:", e));
}