import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  const now = new Date();
  const iso = now.toISOString();
  const s = { trial: 0, expired: 0, locked: 0, abandoned: 0 };
  const ev = (id: string, t: string, from: string, to: string) => supabaseAdmin.from("subscription_events").insert({ subscription_id: id, event_type: t, from_status: from as never, to_status: to as never });

  const trials = (await supabaseAdmin.from("subscriptions").select("id").eq("status", "trialing").lte("trial_end", iso)).data || [];
  for (const r of trials) { await supabaseAdmin.from("subscriptions").update({ status: "pending_payment" }).eq("id", r.id); await ev(r.id, "trial_expired", "trialing", "pending_payment"); s.trial++; }

  const exp = (await supabaseAdmin.from("subscriptions").select("id").eq("status", "active").lte("current_period_end", iso)).data || [];
  for (const r of exp) { await supabaseAdmin.from("subscriptions").update({ status: "past_due" }).eq("id", r.id); await ev(r.id, "period_expired", "active", "past_due"); s.expired++; }

  const pd = (await supabaseAdmin.from("subscriptions").select("id, current_period_end, grace_period_days").eq("status", "past_due")).data || [];
  for (const r of pd) {
    if (!r.current_period_end) continue;
    const g = new Date(r.current_period_end); g.setDate(g.getDate() + (r.grace_period_days || 7));
    if (now > g) { await supabaseAdmin.from("subscriptions").update({ status: "locked" }).eq("id", r.id); await ev(r.id, "auto_locked", "past_due", "locked"); s.locked++; }
  }

  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  const ab = (await supabaseAdmin.from("subscriptions").select("id").eq("status", "pending_payment").lt("last_charge_attempt_at", hourAgo)).data || [];
  for (const r of ab) { await supabaseAdmin.from("subscriptions").update({ status: "canceled", canceled_at: iso }).eq("id", r.id); await ev(r.id, "abandoned_checkout", "pending_payment", "canceled"); s.abandoned++; }

  return res.status(200).json({ ok: true, summary: s, ts: iso });
}