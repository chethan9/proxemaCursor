import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getGateway } from "@/lib/payments";
import { consumeCoupon } from "@/services/couponService.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: auth } } });
  const { data: ud } = await supa.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: "Unauthorized" });

  const { subscriptionId, couponCode } = req.body as { subscriptionId: string; couponCode?: string };
  const { data: sub } = await supabaseAdmin.from("subscriptions").select("*, plans(*), clients(country,currency)").eq("id", subscriptionId).single();
  if (!sub) return res.status(404).json({ error: "Subscription not found" });

  type Plan = { name?: string; prices?: Record<string, number> };
  type Client = { country?: string | null; currency?: string | null };
  const plan = sub.plans as Plan | null;
  const client = sub.clients as Client | null;
  const currency = sub.currency || client?.currency || "USD";
  const baseAmt = plan?.prices?.[currency] ?? 0;
  if (!baseAmt) return res.status(400).json({ error: `No price for ${currency}` });

  let amt = baseAmt;
  if (couponCode) {
    const c = await consumeCoupon(couponCode, sub.plan_id, sub.client_id);
    if (c.ok && c.discountMinor) amt = Math.max(0, baseAmt - c.discountMinor);
  }

  const gatewayName = (sub.gateway || "razorpay") as "myfatoorah" | "razorpay" | "tap";

  if (gatewayName === "tap") {
    await supabaseAdmin.from("subscriptions").update({ gateway: "tap" }).eq("id", subscriptionId);
    return res.status(200).json({
      subscriptionId: sub.id,
      gateway: "tap",
      payload: { type: "tap-redirect-page", redirectUrl: `/billing/tap?sub=${sub.id}` },
      discount: baseAmt - amt,
    });
  }

  const gw = getGateway(gatewayName);
  const host = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
  const init = await gw.initiateCharge({
    amountMinor: amt,
    currency,
    description: `${plan?.name || "Plan"} subscription`,
    customerEmail: ud.user.email || "",
    clientReference: `sub_${sub.id}_${Date.now()}`,
    returnUrl: `${host}/billing/return?sub=${sub.id}`,
  });
  await supabaseAdmin.from("subscriptions").update({ gateway: init.gateway, gateway_subscription_ref: init.gatewayRef }).eq("id", sub.id);
  return res.status(200).json({ subscriptionId: sub.id, gateway: init.gateway, payload: init.payload, discount: baseAmt - amt });
}
