import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds } from "@/lib/woo-client";
import { getWooUserAgent } from "@/lib/brand-name-server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { storeId, wooId } = req.query;
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });
  if (!wooId || typeof wooId !== "string") return res.status(400).json({ error: "Woo ID required" });

  const wooIdNum = parseInt(wooId, 10);
  if (isNaN(wooIdNum)) return res.status(400).json({ error: "Invalid Woo ID" });

  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("store_id", storeId)
    .eq("woo_id", wooIdNum)
    .maybeSingle();
  if (existing) return res.status(200).json(existing);

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(404).json({ error: "Store not found" });

  try {
    const auth = Buffer.from(`${store.consumer_key}:${store.consumer_secret}`).toString("base64");
    const ua = await getWooUserAgent();
    const url = `${store.url.replace(/\/$/, "")}/wp-json/wc/v3/orders/${wooIdNum}`;
    const r = await fetch(url, { headers: { Authorization: `Basic ${auth}`, "User-Agent": ua } });
    if (!r.ok) return res.status(r.status).json({ error: "Woo fetch failed" });
    const o = await r.json() as Record<string, unknown>;

    const row = {
      store_id: storeId,
      woo_id: wooIdNum,
      order_number: o.number as string,
      status: o.status as string,
      currency: o.currency as string,
      total: o.total as string,
      subtotal: (o.subtotal as string) || null,
      total_tax: o.total_tax as string,
      shipping_total: o.shipping_total as string,
      discount_total: o.discount_total as string,
      payment_method: o.payment_method as string,
      payment_method_title: o.payment_method_title as string,
      customer_id: o.customer_id as number | null,
      customer_note: o.customer_note as string,
      billing: o.billing,
      shipping: o.shipping,
      line_items: o.line_items,
      shipping_lines: o.shipping_lines,
      fee_lines: o.fee_lines,
      coupon_lines: o.coupon_lines,
      refunds: o.refunds,
      meta_data: o.meta_data,
      date_created: o.date_created as string,
      date_modified: o.date_modified as string,
      date_completed: o.date_completed as string | null,
      date_paid: o.date_paid as string | null,
      raw_data: o,
      synced_at: new Date().toISOString(),
    };
    const { data: upserted, error } = await supabaseAdmin
      .from("orders")
      .upsert(row as never, { onConflict: "store_id,woo_id" })
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(upserted);
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Fetch failed" });
  }
}