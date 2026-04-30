import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { isAdminRole, resolveUserFromRequest } from "@/lib/server-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const me = await resolveUserFromRequest(req);
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (!isAdminRole(me.role)) return res.status(403).json({ error: "Forbidden" });

  const id = String(req.query.id || "");
  if (!id) return res.status(400).json({ error: "Missing id" });

  const { data: payout, error } = await supabaseAdmin
    .from("referral_payout_requests")
    .select(`*, clients:referrer_client_id ( id, name )`)
    .eq("id", id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!payout) return res.status(404).json({ error: "Not found" });

  const { data: balance } = await supabaseAdmin
    .from("referral_balances")
    .select("*")
    .eq("referrer_client_id", payout.referrer_client_id)
    .eq("currency", payout.currency)
    .maybeSingle();

  const { data: profile } = await supabaseAdmin
    .from("referral_profiles")
    .select("*")
    .eq("client_id", payout.referrer_client_id)
    .maybeSingle();

  const { data: recentEvents } = await supabaseAdmin
    .from("referral_events")
    .select("id, event_type, amount_minor, currency, status, source, created_at")
    .eq("referrer_client_id", payout.referrer_client_id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Best-effort: find the requesting user's email to display on the admin screen.
  let requestedByEmail: string | null = null;
  if (payout.requested_by) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", payout.requested_by)
      .maybeSingle();
    requestedByEmail = prof?.email || prof?.full_name || null;
  }

  return res.status(200).json({ payout, balance, profile, recentEvents: recentEvents || [], requestedByEmail });
}
