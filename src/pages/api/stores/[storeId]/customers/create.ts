import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWooClient } from "@/lib/woo-client";
import { requireAuth } from "@/lib/api-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = await requireAuth(req, res);
  if (!user) return;
  const { storeId } = req.query as { storeId: string };

  const { data: store, error: storeErr } = await supabaseAdmin.from("stores").select("*").eq("id", storeId).single();
  if (storeErr || !store) return res.status(404).json({ error: "Store not found" });

  const woo = getWooClient(store);
  if (!woo) return res.status(400).json({ error: "Store not connected" });

  const payload = req.body as {
    email: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    password?: string;
    billing?: Record<string, string>;
    shipping?: Record<string, string>;
  };

  if (!payload.email) return res.status(400).json({ error: "email required" });

  try {
    const wooRes = await woo.post("customers", payload);
    const wooData = wooRes.data as Record<string, unknown>;
    const insert = {
      store_id: storeId,
      woo_id: wooData.id as number,
      email: (wooData.email as string) || payload.email,
      first_name: (wooData.first_name as string) || payload.first_name || null,
      last_name: (wooData.last_name as string) || payload.last_name || null,
      username: (wooData.username as string) || payload.username || null,
      role: (wooData.role as string) || "customer",
      billing: wooData.billing ?? payload.billing ?? {},
      shipping: wooData.shipping ?? payload.shipping ?? {},
      avatar_url: (wooData.avatar_url as string) || null,
      is_paying_customer: (wooData.is_paying_customer as boolean) ?? false,
      orders_count: 0,
      total_spent: "0.00",
      raw_data: wooData,
      date_created: (wooData.date_created as string) || new Date().toISOString(),
      synced_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin.from("customers").insert(insert).select("*").single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (e) {
    const err = e as { response?: { data?: { message?: string } }; message?: string };
    return res.status(502).json({ error: "Woo create failed", message: err.response?.data?.message || err.message });
  }
}