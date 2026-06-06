import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getGateway } from "@/lib/payments";
import type { GatewayName } from "@/lib/payments/types";
import { validateCoupon } from "@/services/couponService.server";
import { getResolvedGatewayForCountry } from "@/lib/payments/gateway-routing.server";
import { ensurePlanPolarRefs } from "@/lib/payments/polar-plan-sync.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: ud } = await supa.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: "Unauthorized" });

  const body = req.body as { planId?: string; subscriptionId?: string; couponCode?: string };
  const planId = body.planId?.trim();
  const subscriptionIdIn = body.subscriptionId?.trim();
  const couponCode = body.couponCode?.trim();

  if (!planId && !subscriptionIdIn) {
    return res.status(400).json({ error: "Missing planId or subscriptionId" });
  }

  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id").eq("id", ud.user.id).maybeSingle();
  const clientId = profile?.client_id as string | undefined;
  if (!clientId) return res.status(400).json({ error: "No client" });

  let resolvedId: string;

  if (planId) {
    try {
      const created = await ensurePendingSubscriptionForPlan(clientId, planId, couponCode);
      resolvedId = created.id;
    } catch (e) {
      return res.status(400).json({ error: e instanceof Error ? e.message : "Checkout error" });
    }
  } else {
    const { data: subRow } = await supabaseAdmin
      .from("subscriptions")
      .select("id, client_id")
      .eq("id", subscriptionIdIn!)
      .maybeSingle();
    if (!subRow || subRow.client_id !== clientId) return res.status(404).json({ error: "Subscription not found" });
    resolvedId = subRow.id;
  }

  const { data: cli } = await supabaseAdmin.from("clients").select("country").eq("id", clientId).maybeSingle();
  const routedGw = await getResolvedGatewayForCountry(cli?.country);
  await supabaseAdmin
    .from("subscriptions")
    .update({ gateway: routedGw as never, updated_at: new Date().toISOString() })
    .eq("id", resolvedId);

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("*, plans(*), clients(country,currency)")
    .eq("id", resolvedId)
    .single();
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
    const c = await validateCoupon(couponCode, sub.plan_id, sub.client_id, Math.round(baseAmt * 100), currency);
    if (c.valid && c.discountMinor) amt = Math.max(0, baseAmt - c.discountMinor / 100);
  }

  const gatewayName = (sub.gateway || "razorpay") as GatewayName;

  if (gatewayName === "tap") {
    await supabaseAdmin
      .from("subscriptions")
      .update({ gateway: "tap" as never, updated_at: new Date().toISOString() })
      .eq("id", resolvedId);
    return res.status(200).json({
      subscriptionId: sub.id,
      gateway: "tap",
      payload: { type: "tap-redirect-page", redirectUrl: `/billing/tap?sub=${sub.id}` },
      discount: baseAmt - amt,
    });
  }

  const host = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
  const returnUrl = `${host}/billing/return?sub=${sub.id}`;

  if (gatewayName === "polar") {
    try {
      const polarRefs = await ensurePlanPolarRefs(sub.plan_id);
      const gw = getGateway("polar");
      const init = await gw.initiateCharge({
        amountMinor: Math.round(amt * 100),
        currency,
        description: `${plan?.name || "Plan"} subscription`,
        customerEmail: ud.user.email || "",
        clientReference: `sub_${sub.id}_${Date.now()}`,
        returnUrl,
        metadata: {
          polarProductId: polarRefs.product_id,
          subscriptionId: sub.id,
          externalCustomerId: clientId,
          purpose: "subscription",
          polarAllowTrial: String((sub.plans as { trial_days?: number } | null)?.trial_days ?? 0) !== "0" ? "true" : "false",
        },
      });
      await supabaseAdmin
        .from("subscriptions")
        .update({
          gateway: "polar" as never,
          gateway_subscription_ref: init.gatewayRef,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
      return res.status(200).json({
        subscriptionId: sub.id,
        gateway: "polar",
        payload: init.payload,
        discount: baseAmt - amt,
      });
    } catch (e) {
      return res.status(502).json({ error: e instanceof Error ? e.message : "Polar checkout failed" });
    }
  }

  const gw = getGateway(gatewayName);
  const init = await gw.initiateCharge({
    amountMinor: Math.round(amt * 100),
    currency,
    description: `${plan?.name || "Plan"} subscription`,
    customerEmail: ud.user.email || "",
    clientReference: `sub_${sub.id}_${Date.now()}`,
    returnUrl: `${host}/billing/return?sub=${sub.id}`,
  });
  await supabaseAdmin
    .from("subscriptions")
    .update({
      gateway: init.gateway as never,
      gateway_subscription_ref: init.gatewayRef,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);
  return res.status(200).json({ subscriptionId: sub.id, gateway: init.gateway, payload: init.payload, discount: baseAmt - amt });
}

async function ensurePendingSubscriptionForPlan(clientId: string, planId: string, couponCode?: string) {
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("id, prices, is_active")
    .eq("id", planId)
    .maybeSingle();
  if (!plan?.is_active) throw new Error("Plan not found");

  const { data: clientRow } = await supabaseAdmin.from("clients").select("country, currency").eq("id", clientId).single();
  const country = clientRow?.country || "US";
  const gatewayName = await getResolvedGatewayForCountry(country);

  const prices = (plan.prices as Record<string, number>) || {};
  const currency =
    clientRow?.currency && prices[clientRow.currency] != null
      ? clientRow.currency
      : prices.USD != null
        ? "USD"
        : Object.keys(prices)[0] || "USD";

  const baseAmtMinor = Math.round((prices[currency] ?? 0) * 100);

  let pendingCouponId: string | null = null;
  if (couponCode) {
    const c = await validateCoupon(couponCode, planId, clientId, baseAmtMinor, currency);
    if (c.valid && c.coupon) pendingCouponId = c.coupon.id;
  }

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("id, status, plan_id")
    .eq("client_id", clientId)
    .neq("status", "canceled")
    .maybeSingle();

  const now = new Date().toISOString();

  if (!existing) {
    const { data: inserted, error } = await supabaseAdmin
      .from("subscriptions")
      .insert({
        client_id: clientId,
        plan_id: planId,
        status: "pending_payment",
        currency,
        gateway: gatewayName as never,
        renewal_mode: "auto",
        grace_period_days: 7,
        pending_coupon_id: pendingCouponId,
        updated_at: now,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message || "Could not start checkout");
    return inserted as { id: string };
  }

  if (existing.status === "locked") {
    throw new Error("Subscription locked");
  }

  if (existing.status === "pending_payment") {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        plan_id: planId,
        currency,
        gateway: gatewayName as never,
        pending_coupon_id: pendingCouponId,
        gateway_subscription_ref: null,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id };
  }

  if (existing.status === "active" || existing.status === "trialing" || existing.status === "past_due") {
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({
        plan_id: planId,
        status: "pending_payment",
        currency,
        gateway: gatewayName as never,
        pending_coupon_id: pendingCouponId,
        gateway_subscription_ref: null,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id };
  }

  throw new Error("Cannot start checkout for this subscription state");
}
