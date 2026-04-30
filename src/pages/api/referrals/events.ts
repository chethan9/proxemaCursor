import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveUserFromRequest } from "@/lib/server-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const me = await resolveUserFromRequest(req);
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (!me.clientId) return res.status(400).json({ error: "Profile is not associated with a client" });

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { data, error } = await supabaseAdmin
    .from("referral_events")
    .select("id, event_type, amount_minor, currency, status, source, reason, created_at, attribution_id")
    .eq("referrer_client_id", me.clientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data: data || [] });
}
