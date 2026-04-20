import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds } from "@/lib/woo-client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { storeId, wooId } = req.query;
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });
  if (!wooId || typeof wooId !== "string") return res.status(400).json({ error: "Woo ID required" });

  const wooIdNum = parseInt(wooId, 10);
  if (isNaN(wooIdNum)) return res.status(400).json({ error: "Invalid Woo ID" });

  const { data: existing } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .eq("woo_id", wooIdNum)
    .maybeSingle();
  if (existing) return res.status(200).json(existing);

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(404).json({ error: "Store not found" });

  try {
    const auth = Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64");
    const url = `${store.url.replace(/\/$/, "")}/wp-json/wc/v3/products/${wooIdNum}`;
    const r = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!r.ok) return res.status(r.status).json({ error: "Woo fetch failed" });
    const p = await r.json() as Record<string, unknown>;

    const row = {
      store_id: storeId,
      woo_id: wooIdNum,
      name: p.name as string,
      slug: p.slug as string,
      sku: p.sku as string,
      price: p.price as string,
      regular_price: p.regular_price as string,
      sale_price: p.sale_price as string,
      stock_quantity: p.stock_quantity as number | null,
      stock_status: p.stock_status as string,
      status: p.status as string,
      type: p.type as string,
      description: p.description as string,
      short_description: p.short_description as string,
      categories: p.categories,
      images: p.images,
      attributes: p.attributes,
      raw_data: p,
      synced_at: new Date().toISOString(),
    };
    const { data: upserted, error } = await supabaseAdmin
      .from("products")
      .upsert(row as never, { onConflict: "store_id,woo_id" })
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(upserted);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Fetch failed" });
  }
}