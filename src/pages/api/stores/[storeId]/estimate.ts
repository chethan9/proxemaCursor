import type { NextApiRequest, NextApiResponse } from "next";
import { getStoreCreds } from "@/lib/woo-client";

async function countEndpoint(store: { url: string; consumer_key: string; consumer_secret: string }, endpoint: string): Promise<number> {
  const auth = Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64");
  const url = `${store.url.replace(/\/$/, "")}/wp-json/wc/v3/${endpoint}?per_page=1`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return 0;
    const total = res.headers.get("x-wp-total");
    return total ? parseInt(total, 10) || 0 : 0;
  } catch {
    clearTimeout(t);
    return 0;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { storeId } = req.query;
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(404).json({ error: "Store not found or not connected" });

  try {
    const [products, orders, customers, categories, tags, coupons] = await Promise.all([
      countEndpoint(store, "products"),
      countEndpoint(store, "orders"),
      countEndpoint(store, "customers"),
      countEndpoint(store, "products/categories"),
      countEndpoint(store, "products/tags"),
      countEndpoint(store, "coupons"),
    ]);

    const total = products + orders + customers + categories + tags + coupons;
    // Rough estimate: ~120 records/sec (batched upserts)
    const etaSeconds = Math.max(10, Math.ceil(total / 120));

    return res.status(200).json({
      counts: { products, orders, customers, categories, tags, coupons },
      total,
      eta_seconds: etaSeconds,
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Estimate failed" });
  }
}