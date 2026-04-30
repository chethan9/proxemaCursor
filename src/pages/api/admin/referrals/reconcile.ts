import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { isAdminRole, resolveUserFromRequest } from "@/lib/server-auth";
import { logActivity } from "@/lib/activity-log";

interface ReconcileRow {
  referrer_client_id: string;
  currency: string;
  was: { lifetime_earned_minor: number; reversed_minor: number; withdrawn_minor: number; pending_payout_minor: number; available_minor: number };
  now: { lifetime_earned_minor: number; reversed_minor: number; withdrawn_minor: number; pending_payout_minor: number; available_minor: number };
  drift_minor: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const me = await resolveUserFromRequest(req);
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (!isAdminRole(me.role)) return res.status(403).json({ error: "Forbidden" });

  const dryRun = req.method === "GET" || Boolean(req.query.dryRun) || Boolean(req.body?.dry_run);

  const { data: balances, error } = await supabaseAdmin
    .from("referral_balances")
    .select("*");
  if (error) return res.status(500).json({ error: error.message });

  const drift: ReconcileRow[] = [];
  for (const b of balances || []) {
    if (!dryRun) {
      const { error: rpcErr } = await supabaseAdmin.rpc("recompute_referral_balance", {
        p_client_id: b.referrer_client_id,
        p_currency: b.currency,
      });
      if (rpcErr) continue;
    }
    const { data: refreshed } = await supabaseAdmin
      .from("referral_balances")
      .select("*")
      .eq("referrer_client_id", b.referrer_client_id)
      .eq("currency", b.currency)
      .maybeSingle();
    if (!refreshed) continue;
    const driftMinor =
      Math.abs(b.lifetime_earned_minor - refreshed.lifetime_earned_minor)
      + Math.abs(b.reversed_minor - refreshed.reversed_minor)
      + Math.abs(b.withdrawn_minor - refreshed.withdrawn_minor)
      + Math.abs(b.pending_payout_minor - refreshed.pending_payout_minor);
    if (driftMinor > 0) {
      drift.push({
        referrer_client_id: b.referrer_client_id,
        currency: b.currency,
        was: {
          lifetime_earned_minor: b.lifetime_earned_minor,
          reversed_minor: b.reversed_minor,
          withdrawn_minor: b.withdrawn_minor,
          pending_payout_minor: b.pending_payout_minor,
          available_minor: b.available_minor,
        },
        now: {
          lifetime_earned_minor: refreshed.lifetime_earned_minor,
          reversed_minor: refreshed.reversed_minor,
          withdrawn_minor: refreshed.withdrawn_minor,
          pending_payout_minor: refreshed.pending_payout_minor,
          available_minor: refreshed.available_minor,
        },
        drift_minor: driftMinor,
      });
    }
  }

  if (!dryRun) {
    await logActivity({
      action: "referral.reconcile.run",
      entityType: "referral_balance",
      metadata: {
        rows_checked: balances?.length || 0,
        rows_with_drift: drift.length,
      },
      actorType: "admin",
      req,
    });
  }

  return res.status(200).json({
    dryRun,
    rowsChecked: balances?.length || 0,
    drift,
  });
}
