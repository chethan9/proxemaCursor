import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { logActivity } from "@/lib/activity-log";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const me = await resolveUserFromRequest(req);
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (!me.clientId) return res.status(400).json({ error: "Profile is not associated with a client" });

  const id = String(req.query.id || "");
  if (!id) return res.status(400).json({ error: "Missing id" });

  const { data: existing, error: getErr } = await supabaseAdmin
    .from("referral_payout_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return res.status(500).json({ error: getErr.message });
  if (!existing) return res.status(404).json({ error: "Payout request not found" });
  if (existing.referrer_client_id !== me.clientId) return res.status(403).json({ error: "Forbidden" });
  if (existing.status !== "pending") {
    return res.status(409).json({ error: `Cannot cancel a ${existing.status} request` });
  }

  const { data, error } = await supabaseAdmin
    .from("referral_payout_requests")
    .update({ status: "canceled" })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await logActivity({
    action: "referral.payout.canceled",
    entityType: "referral_payout_request",
    entityId: id,
    clientId: me.clientId,
    metadata: { canceled_by: "user" },
    actorType: "user",
    req,
  });

  return res.status(200).json({ payout: data });
}
