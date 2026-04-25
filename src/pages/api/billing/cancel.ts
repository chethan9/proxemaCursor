import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { logActivity } from "@/lib/activity-log";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { subscriptionId, uncancel } = req.body || {};
  if (!subscriptionId) return res.status(400).json({ error: "subscriptionId required" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Auth required" });
  const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: ud } = await userClient.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: "Invalid session" });

  const { data: sub, error: subErr } = await supabaseAdmin.from("subscriptions").select("id, client_id, status").eq("id", subscriptionId).single();
  if (subErr || !sub) return res.status(404).json({ error: "Subscription not found" });

  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id, role").eq("id", ud.user.id).single();
  const isOwner = profile?.client_id === sub.client_id;
  const isAdmin = profile?.role === "admin";
  if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });

  const willCancel = !uncancel;
  const { error } = await supabaseAdmin.from("subscriptions").update({ cancel_at_period_end: willCancel } as never).eq("id", subscriptionId);
  if (error) return res.status(500).json({ error: error.message });

  await logActivity({
    actorType: "user",
    req,
    clientId: sub.client_id,
    entityType: "subscription",
    entityId: subscriptionId,
    action: willCancel ? "subscription.cancel_scheduled" : "subscription.cancel_revoked",
    metadata: { subscription_id: subscriptionId, uncancel: !!uncancel },
  });

  return res.status(200).json({ ok: true, cancel_at_period_end: willCancel });
}
