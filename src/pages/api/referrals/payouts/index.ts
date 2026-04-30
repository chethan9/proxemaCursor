import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { logActivity } from "@/lib/activity-log";
import {
  findProfileByClientId,
  getOrCreateBalance,
  getReferralSettings,
} from "@/services/referralService.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (!me.clientId) return res.status(400).json({ error: "Profile is not associated with a client" });

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("referral_payout_requests")
      .select("*")
      .eq("referrer_client_id", me.clientId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data: data || [] });
  }

  if (req.method === "POST") {
    const settings = await getReferralSettings();
    if (!settings.is_enabled) return res.status(403).json({ error: "Referral program is disabled" });

    const profile = await findProfileByClientId(me.clientId);
    if (!profile) return res.status(404).json({ error: "Not enrolled in referral program" });
    if (profile.status !== "active") return res.status(403).json({ error: "Referral profile is not active" });
    if (settings.require_referrer_paid && !profile.has_paid_purchase) {
      return res.status(403).json({
        error: "withdrawal_requires_paid_purchase",
        reason: "You can earn referral rewards now, but a successful paid plan purchase is required before requesting a withdrawal.",
      });
    }

    const amountMinor = Number(req.body?.amount_minor);
    const currency = String(req.body?.currency || settings.payout_currency).toUpperCase();
    const payoutMethod = req.body?.payout_method ? String(req.body.payout_method) : profile.payout_method || null;
    const payoutDetails = req.body?.payout_details && typeof req.body.payout_details === "object"
      ? req.body.payout_details
      : profile.payout_details || {};
    const notes = req.body?.notes ? String(req.body.notes).slice(0, 1000) : null;

    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    if (settings.min_payout_minor > 0 && amountMinor < settings.min_payout_minor) {
      return res.status(400).json({
        error: "amount_below_minimum",
        min_payout_minor: settings.min_payout_minor,
        currency: settings.payout_currency,
      });
    }

    const balance = await getOrCreateBalance({ clientId: me.clientId, currency });
    if (amountMinor > balance.available_minor) {
      return res.status(400).json({
        error: "insufficient_balance",
        available_minor: balance.available_minor,
        currency,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("referral_payout_requests")
      .insert({
        referrer_client_id: me.clientId,
        requested_by: me.userId,
        currency,
        amount_minor: amountMinor,
        status: "pending",
        payout_method: payoutMethod,
        payout_details: payoutDetails as never,
        notes,
      })
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await logActivity({
      action: "referral.payout.requested",
      entityType: "referral_payout_request",
      entityId: data.id,
      clientId: me.clientId,
      metadata: {
        amount_minor: amountMinor,
        currency,
        payout_method: payoutMethod,
      },
      actorType: "user",
      req,
    });

    return res.status(201).json({ payout: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
