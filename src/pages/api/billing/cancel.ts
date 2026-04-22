import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { subscriptionId, uncancel } = req.body;
  if (!subscriptionId) return res.status(400).json({ error: "Missing subscriptionId" });
  const { error } = await supabaseAdmin.from("subscriptions").update({ cancel_at_period_end: !uncancel }).eq("id", subscriptionId);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}