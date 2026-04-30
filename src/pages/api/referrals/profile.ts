import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveUserFromRequest } from "@/lib/server-auth";
import {
  ensureReferralProfile,
  findProfileByClientId,
  getReferralSettings,
} from "@/services/referralService.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (!me.clientId) return res.status(400).json({ error: "Profile is not associated with a client" });

  const settings = await getReferralSettings();

  if (req.method === "GET") {
    const profile = await findProfileByClientId(me.clientId);
    const { data: balances } = await supabaseAdmin
      .from("referral_balances")
      .select("*")
      .eq("referrer_client_id", me.clientId);
    let stats: { total: number; converted: number } = { total: 0, converted: 0 };
    if (profile) {
      const { count: total } = await supabaseAdmin
        .from("referral_attributions")
        .select("id", { count: "exact", head: true })
        .eq("referrer_client_id", me.clientId);
      const { count: converted } = await supabaseAdmin
        .from("referral_attributions")
        .select("id", { count: "exact", head: true })
        .eq("referrer_client_id", me.clientId)
        .eq("converted", true);
      stats = { total: total ?? 0, converted: converted ?? 0 };
    }
    return res.status(200).json({
      enabled: settings.is_enabled,
      profile,
      balances: balances || [],
      stats,
      settings: {
        signup_bonus_minor: settings.signup_bonus_minor,
        paid_percentage_bps: settings.paid_percentage_bps,
        min_payout_minor: settings.min_payout_minor,
        payout_currency: settings.payout_currency,
        require_referrer_paid: settings.require_referrer_paid,
        payout_methods: settings.payout_methods,
      },
    });
  }

  if (req.method === "POST") {
    if (!settings.is_enabled) {
      return res.status(403).json({ error: "Referral program is currently disabled" });
    }
    const profile = await ensureReferralProfile({ clientId: me.clientId, userId: me.userId });
    return res.status(200).json({ profile });
  }

  if (req.method === "PATCH") {
    const { payout_method, payout_details, notes } = req.body || {};
    const existing = await findProfileByClientId(me.clientId);
    if (!existing) return res.status(404).json({ error: "Not enrolled" });
    const updates: Record<string, unknown> = {};
    if (typeof payout_method === "string") updates.payout_method = payout_method;
    if (payout_details && typeof payout_details === "object") updates.payout_details = payout_details;
    if (typeof notes === "string") updates.notes = notes.slice(0, 1000);
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Nothing to update" });
    const { data, error } = await supabaseAdmin
      .from("referral_profiles")
      .update(updates as never)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ profile: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
