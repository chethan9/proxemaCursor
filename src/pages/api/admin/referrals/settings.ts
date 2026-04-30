import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { isAdminRole, resolveUserFromRequest } from "@/lib/server-auth";
import { logActivity } from "@/lib/activity-log";
import { clearReferralSettingsCache, getReferralSettings } from "@/services/referralService.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (!isAdminRole(me.role)) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const settings = await getReferralSettings(true);
    return res.status(200).json({ settings });
  }

  if (req.method === "PATCH" || req.method === "PUT") {
    const body = req.body || {};
    const allowed = [
      "is_enabled",
      "signup_bonus_minor",
      "paid_percentage_bps",
      "paid_percentage_max_minor",
      "recurring_percentage_bps",
      "recurring_max_count",
      "min_payout_minor",
      "payout_currency",
      "eligibility_window_days",
      "reversal_window_days",
      "require_referrer_paid",
      "payout_methods",
      "notes",
    ] as const;
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }
    updates.updated_by = me.userId;
    updates.updated_at = new Date().toISOString();

    const before = await getReferralSettings(true);
    const { data, error } = await supabaseAdmin
      .from("referral_settings")
      .update(updates as never)
      .eq("id", "singleton")
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    clearReferralSettingsCache();

    await logActivity({
      action: "referral.settings.updated",
      entityType: "referral_settings",
      entityId: "singleton",
      before: before as unknown as Record<string, unknown>,
      after: data as unknown as Record<string, unknown>,
      actorType: "admin",
      req,
    });

    return res.status(200).json({ settings: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
