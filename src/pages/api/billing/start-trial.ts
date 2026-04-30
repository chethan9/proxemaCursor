import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { insertSubscriptionEvent } from "@/services/subscriptionService.server";
import { logActivity } from "@/lib/activity-log";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const me = await resolveUserFromRequest(req);
  if (!me?.userId) return res.status(401).json({ error: "Unauthorized" });
  if (!me.clientId) return res.status(400).json({ error: "No client" });

  const { planId } = req.body as { planId?: string };
  if (!planId) return res.status(400).json({ error: "Missing planId" });

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("id, slug, prices, trial_days, is_active")
    .eq("id", planId)
    .maybeSingle();
  if (!plan || !plan.is_active) return res.status(404).json({ error: "Plan not found" });

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status")
    .eq("client_id", me.clientId)
    .neq("status", "canceled")
    .maybeSingle();
  if (existing) {
    return res.status(409).json({ error: "Subscription already exists", subscriptionId: existing.id });
  }

  const trialDays = plan.trial_days ?? 14;
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + trialDays);

  const prices = (plan.prices as Record<string, number>) || {};
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("currency")
    .eq("id", me.clientId)
    .maybeSingle();
  const currency = client?.currency && prices[client.currency] != null
    ? client.currency
    : (prices.USD != null ? "USD" : Object.keys(prices)[0] || "USD");

  const { data: sub, error } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      client_id: me.clientId,
      plan_id: plan.id,
      status: "trialing",
      trial_end: trialEnd.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEnd.toISOString(),
      currency,
      grace_period_days: 7,
      renewal_mode: "auto",
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await insertSubscriptionEvent(sub.id, "trial_started", null, "trialing", {
    plan_slug: plan.slug,
    plan_id: plan.id,
    trial_days: trialDays,
  });

  await logActivity({
    actorType: "user",
    action: "subscription.trial_started",
    entityType: "subscription",
    entityId: sub.id,
    clientId: me.clientId,
    metadata: { plan_slug: plan.slug, plan_id: plan.id, trial_days: trialDays },
    req,
  });

  return res.status(200).json({ subscriptionId: sub.id, trialEnd: sub.trial_end });
}
