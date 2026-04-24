import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: auth } } });
  const { data: ud } = await supa.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: "Unauthorized" });

  const { subscriptionId } = req.body as { subscriptionId: string };
  const { data: sub } = await supabaseAdmin.from("subscriptions").select("id, client_id, gateway").eq("id", subscriptionId).single();
  if (!sub) return res.status(404).json({ error: "Subscription not found" });
  if ((sub.gateway as string) !== "tap") return res.status(400).json({ error: "Subscription is not Tap-routed" });

  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id, email, full_name").eq("id", ud.user.id).single();
  if (profile?.client_id !== sub.client_id) return res.status(403).json({ error: "Forbidden" });

  const publishableKey = process.env.TAP_PUBLIC_KEY;
  if (!publishableKey) return res.status(503).json({ error: "Tap not configured" });

  return res.status(200).json({
    publishableKey,
    subscriptionId: sub.id,
    customerEmail: profile?.email || ud.user.email || "",
    customerName: profile?.full_name || "",
  });
}