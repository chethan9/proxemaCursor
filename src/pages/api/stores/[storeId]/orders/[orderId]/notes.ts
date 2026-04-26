import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";

interface WooOrderNote {
  id: number;
  author: string;
  date_created: string;
  date_created_gmt: string;
  note: string;
  customer_note: boolean;
  added_by_user: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId, orderId } = req.query;
  if (typeof storeId !== "string" || typeof orderId !== "string") {
    return res.status(400).json({ error: "storeId and orderId required" });
  }

  const { data: localOrder } = await supabaseAdmin
    .from("orders")
    .select("woo_id")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (!localOrder?.woo_id) return res.status(404).json({ error: "Order not found" });

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(400).json({ error: "Store not connected" });

  try {
    if (req.method === "GET") {
      const notes = await wooRequest<WooOrderNote[]>(
        store,
        "GET",
        `orders/${localOrder.woo_id}/notes?per_page=100`
      );
      return res.status(200).json(notes);
    }

    if (req.method === "POST") {
      const { note, customer_note } = (req.body || {}) as { note?: string; customer_note?: boolean };
      if (!note?.trim()) return res.status(400).json({ error: "note required" });
      const created = await wooRequest<WooOrderNote>(
        store,
        "POST",
        `orders/${localOrder.woo_id}/notes`,
        { note: note.trim(), customer_note: !!customer_note }
      );
      return res.status(201).json(created);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[order notes]", err);
    return res.status(500).json({ error: "Failed", message });
  }
}