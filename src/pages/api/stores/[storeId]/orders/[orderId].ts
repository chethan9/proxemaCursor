import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Json } from "@/integrations/supabase/database.types";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

interface WooOrder {
  id: number;
  number: string;
  status: string;
  currency: string;
  total: string;
  subtotal: string;
  total_tax: string;
  discount_total: string;
  shipping_total: string;
  customer_id: number;
  payment_method: string;
  payment_method_title: string;
  billing: Record<string, unknown>;
  shipping: Record<string, unknown>;
  line_items: unknown[];
  shipping_lines: unknown[];
  fee_lines: unknown[];
  coupon_lines: unknown[];
  date_created: string;
  date_modified: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId, orderId } = req.query;
  if (typeof storeId !== "string" || typeof orderId !== "string") {
    return res.status(400).json({ error: "storeId and orderId required" });
  }

  try {
    const store = await getStoreCreds(storeId);
    if (!store) return res.status(404).json({ error: "Store not connected" });

    const { data: localOrder, error: localErr } = await supabaseAdmin
      .from("orders")
      .select("id, woo_id")
      .eq("id", orderId)
      .eq("store_id", storeId)
      .single();
    if (localErr || !localOrder?.woo_id) {
      return res.status(404).json({ error: "Order not found" });
    }

    const { status } = req.body || {};
    const wooPayload: Record<string, unknown> = {};
    if (status !== undefined) wooPayload.status = status;

    const updated = await wooRequest<WooOrder>(
      store,
      "PUT",
      `orders/${localOrder.woo_id}`,
      wooPayload
    );

    const now = new Date().toISOString();
    const { data: saved, error: saveErr } = await supabaseAdmin
      .from("orders")
      .update({
        order_number: updated.number,
        status: updated.status,
        currency: updated.currency,
        total: updated.total ? parseFloat(updated.total) : null,
        subtotal: updated.subtotal ? parseFloat(updated.subtotal) : null,
        total_tax: updated.total_tax ? parseFloat(updated.total_tax) : null,
        discount_total: updated.discount_total ? parseFloat(updated.discount_total) : null,
        shipping_total: updated.shipping_total ? parseFloat(updated.shipping_total) : null,
        payment_method: updated.payment_method,
        payment_method_title: updated.payment_method_title,
        billing: toJson(updated.billing),
        shipping: toJson(updated.shipping),
        line_items: toJson(updated.line_items),
        shipping_lines: toJson(updated.shipping_lines || []),
        fee_lines: toJson(updated.fee_lines || []),
        coupon_lines: toJson(updated.coupon_lines || []),
        raw_data: toJson(updated),
        date_modified: updated.date_modified,
        synced_at: now,
      })
      .eq("id", orderId)
      .select("*")
      .single();

    if (saveErr) throw saveErr;
    return res.status(200).json(saved);
  } catch (err) {
    console.error("[order update] error:", err);
    return res.status(500).json({
      error: "Failed to update order",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}