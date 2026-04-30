import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { logActivity } from "@/lib/activity-log";

/**
 * Recompute every (referrer_client_id, currency) referral_balances row from
 * the immutable ledger to detect drift caused by a missed trigger or manual
 * data fix. Runs idempotent updates and logs counts to cron_logs.
 *
 * Schedule via Vercel cron or external cron with `Authorization: Bearer
 * $CRON_SECRET`.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const startedAt = Date.now();
  const { data: balances, error } = await supabaseAdmin
    .from("referral_balances")
    .select("referrer_client_id, currency, lifetime_earned_minor, reversed_minor, withdrawn_minor, pending_payout_minor");
  if (error) {
    return res.status(500).json({ error: error.message });
  }

  let driftCount = 0;
  let recomputed = 0;
  for (const b of balances || []) {
    const before = {
      lifetime_earned_minor: b.lifetime_earned_minor,
      reversed_minor: b.reversed_minor,
      withdrawn_minor: b.withdrawn_minor,
      pending_payout_minor: b.pending_payout_minor,
    };
    const { error: rpcErr } = await supabaseAdmin.rpc("recompute_referral_balance", {
      p_client_id: b.referrer_client_id,
      p_currency: b.currency,
    });
    if (rpcErr) continue;
    recomputed++;
    const { data: refreshed } = await supabaseAdmin
      .from("referral_balances")
      .select("*")
      .eq("referrer_client_id", b.referrer_client_id)
      .eq("currency", b.currency)
      .maybeSingle();
    if (!refreshed) continue;
    const driftMinor =
      Math.abs(before.lifetime_earned_minor - refreshed.lifetime_earned_minor)
      + Math.abs(before.reversed_minor - refreshed.reversed_minor)
      + Math.abs(before.withdrawn_minor - refreshed.withdrawn_minor)
      + Math.abs(before.pending_payout_minor - refreshed.pending_payout_minor);
    if (driftMinor > 0) {
      driftCount++;
      await logActivity({
        action: "referral.reconcile.drift_detected",
        entityType: "referral_balance",
        entityId: `${b.referrer_client_id}:${b.currency}`,
        clientId: b.referrer_client_id,
        metadata: { before, after: refreshed, drift_minor: driftMinor },
        actorType: "system",
      });
    }
  }

  const completedAt = new Date().toISOString();
  await supabaseAdmin.from("cron_logs").insert({
    job_type: "referral_reconcile",
    status: "completed",
    message: `recomputed:${recomputed} drift:${driftCount}`,
    completed_at: completedAt,
    metadata: { recomputed, drift_count: driftCount },
  });

  return res.status(200).json({
    ok: true,
    recomputed,
    drift_count: driftCount,
    duration_ms: Date.now() - startedAt,
  });
}
