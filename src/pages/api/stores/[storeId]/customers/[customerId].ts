import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWooClient } from "@/lib/woo-client";
import { requireAuth } from "@/lib/api-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const { storeId, customerId } = req.query as { storeId: string; customerId: string };

  const { data: store, error: storeErr } = await supabaseAdmin.from("stores").select("*").eq("id", storeId).single();
  if (storeErr || !store) return res.status(404).json({ error: "Store not found" });

  const { data: cust, error: custErr } = await supabaseAdmin.from("customers").select("*").eq("id", customerId).eq("store_id", storeId).single();
  if (custErr || !cust) return res.status(404).json({ error: "Customer not found" });

  if (req.method === "GET") {
    return res.status(200).json(cust);
  }

  const woo = getWooClient(store);
  if (!woo) return res.status(400).json({ error: "Store not connected" });

  if (req.method === "PUT") {
    const patch = req.body as { first_name?: string; last_name?: string; email?: string; username?: string; billing?: Record<string, string>; shipping?: Record<string, string> };
    if (!cust.woo_id) return res.status(400).json({ error: "Customer has no Woo ID" });
    try {
      const wooRes = await woo.put(`customers/${cust.woo_id}`, patch);
      const wooData = wooRes.data as Record<string, unknown>;
      const dbPatch: Record<string, unknown> = {
        first_name: wooData.first_name ?? patch.first_name ?? cust.first_name,
        last_name: wooData.last_name ?? patch.last_name ?? cust.last_name,
        email: wooData.email ?? patch.email ?? cust.email,
        username: wooData.username ?? patch.username ?? cust.username,
        billing: wooData.billing ?? patch.billing ?? cust.billing,
        shipping: wooData.shipping ?? patch.shipping ?? cust.shipping,
        raw_data: wooData,
        synced_at: new Date().toISOString(),
      };
      const { data: updated, error: upErr } = await supabaseAdmin.from("customers").update(dbPatch).eq("id", customerId).select("*").single();
      if (upErr) return res.status(500).json({ error: upErr.message });
      return res.status(200).json(updated);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      return res.status(502).json({ error: "Woo update failed", message: err.response?.data?.message || err.message });
    }
  }

  if (req.method === "DELETE") {
    if (!cust.woo_id) {
      await supabaseAdmin.from("customers").delete().eq("id", customerId);
      return res.status(200).json({ ok: true });
    }
    try {
      await woo.delete(`customers/${cust.woo_id}`, { force: true });
      await supabaseAdmin.from("customers").delete().eq("id", customerId);
      return res.status(200).json({ ok: true });
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      return res.status(502).json({ error: "Woo delete failed", message: err.response?.data?.message || err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}