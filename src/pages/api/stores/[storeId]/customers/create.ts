import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Json } from "@/integrations/supabase/database.types";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

interface WooCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  billing: Record<string, unknown>;
  shipping: Record<string, unknown>;
  avatar_url: string;
  is_paying_customer: boolean;
  date_created: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { storeId } = req.query as { storeId: string };

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(400).json({ error: "Store not connected" });

  const payload = req.body as {
    email: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    password?: string;
    billing?: Record<string, unknown>;
    shipping?: Record<string, unknown>;
  };
  if (!payload.email) return res.status(400).json({ error: "email required" });

  try {
    const wooData = await wooRequest<WooCustomer>(store, "POST", "customers", payload);
    const insert = {
      store_id: storeId,
      woo_id: wooData.id,
      email: wooData.email || payload.email,
      first_name: wooData.first_name || payload.first_name || null,
      last_name: wooData.last_name || payload.last_name || null,
      username: wooData.username || payload.username || null,
      role: wooData.role || "customer",
      billing: toJson(wooData.billing ?? payload.billing ?? {}),
      shipping: toJson(wooData.shipping ?? payload.shipping ?? {}),
      avatar_url: wooData.avatar_url || null,
      is_paying_customer: wooData.is_paying_customer ?? false,
      orders_count: 0,
      total_spent: "0.00",
      raw_data: toJson(wooData),
      date_created: wooData.date_created || new Date().toISOString(),
      synced_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseAdmin.from("customers").insert(insert).select("*").single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  } catch (e) {
    const err = e as { message?: string };
    return res.status(502).json({ error: "Woo create failed", message: err.message });
  }
}