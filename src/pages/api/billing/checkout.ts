import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getGatewayForClient } from "@/lib/payments";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: auth } } });
  const { data: ud } = await supa.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: "Unauthorized" });

  const { data: profile } = await supabaseAdmin.from("profiles").select("id,email,client_id").eq("id", ud.user.id).single();
  if (!profile?.client_id) return res.status(403).json({ error: "No client" });

  const { planId } = req.body as { planId: string };
  const { data: plan } = await supabaseAdmin.from("plans").select("*").eq("id", planId).single();
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const { data: client } = await supabaseAdmin.from("clients").select("country,currency").eq("id", profile.client_id).single();
  const currency = client?.currency || "USD";
  const amt = (plan.prices as Record<string, number>)[currency];
  if (!amt) return res.status(400).json({ error: `No price for ${currency}` });

  const gw = getGatewayForClient(client?.country);
  if (!gw.isConfigured()) return res.status(503).json({ error: `${gw.name} not configured` });

  const existing = await supabaseAdmin.from("subscriptions").select("id").eq("client_id", profile.client_id).neq("status", "canceled").maybeSingle();
  let subId: string;
  if (existing.data) {
    subId = existing.data.id;
    await supabaseAdmin.from("subscriptions").update({ plan_id: planId, currency, gateway: gw.name, status: "pending_payment" }).eq("id", subId);
  } else {
    const ins = await supabaseAdmin.from("subscriptions").insert({ client_id: profile.client_id, plan_id: planId, status: "pending_payment", currency, gateway: gw.name, renewal_mode: "auto" }).select().single();
    if (ins.error) return res.status(500).json({ error: ins.error.message });
    subId = ins.data.id;
  }

  const host = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`;
  const init = await gw.initiateCharge({
    amountMinor: amt, currency, description: `${plan.name} plan`,
    customerEmail: profile.email || ud.user.email || "",
    clientReference: `sub_${subId}_${Date.now()}`,
    returnUrl: `${host}/billing/return?sub=${subId}`,
  });

  await supabaseAdmin.from("subscriptions").update({ gateway_subscription_ref: init.gatewayRef, last_charge_attempt_at: new Date().toISOString() }).eq("id", subId);
  return res.status(200).json({ subscriptionId: subId, gateway: init.gateway, payload: init.payload });
}