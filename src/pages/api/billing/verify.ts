import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getGateway } from "@/lib/payments";
import { insertSubscriptionEvent } from "@/services/subscriptionService.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { subscriptionId } = req.body as { subscriptionId: string };
  if (!subscriptionId) return res.status(400).json({ error: "Missing subscriptionId" });

  const { data: sub } = await supabaseAdmin.from("subscriptions").select("*, plans(*)").eq("id", subscriptionId).single();
  if (!sub) return res.status(404).json({ error: "Not found" });
  if (sub.status === "active" || sub.status === "trialing") return res.status(200).json({ status: "already_active", subscription: sub });
  if (!sub.gateway || !sub.gateway_subscription_ref) return res.status(400).json({ error: "No pending charge" });

  try {
    const gw = getGateway(sub.gateway as "myfatoorah" | "razorpay");
    const st = await gw.getPaymentStatus(sub.gateway_subscription_ref);
    if (st.status === "paid") {
      const end = new Date();
      const plan = sub.plans as { billing_interval: string } | null;
      if (plan?.billing_interval === "year") end.setFullYear(end.getFullYear() + 1);
      else end.setMonth(end.getMonth() + 1);

      await supabaseAdmin.from("subscriptions").update({
        status: "active", current_period_start: new Date().toISOString(), current_period_end: end.toISOString(),
        renewal_mode: "manual", auto_renew_disabled_reason: "tokenization_not_implemented", pending_coupon_id: null,
      }).eq("id", subscriptionId);

      if (sub.pending_coupon_id) {
        await supabaseAdmin.from("coupon_redemptions").insert({
          coupon_id: sub.pending_coupon_id, client_id: sub.client_id, subscription_id: subscriptionId,
          discount_minor: st.amountMinor || 0, currency: st.currency || sub.currency,
        });
        await supabaseAdmin.rpc("increment_coupon_redemption_count", { coupon_id_in: sub.pending_coupon_id }).then(() => {}, () => {});
      }

      await insertSubscriptionEvent(subscriptionId, "payment_succeeded", sub.status, "active", {
        gateway: sub.gateway, gatewayRef: sub.gateway_subscription_ref,
        amountMinor: st.amountMinor, currency: st.currency, couponId: sub.pending_coupon_id,
      });

      await supabaseAdmin.from("invoices").insert({
        invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1e6).toString().padStart(6, "0")}`,
        client_id: sub.client_id,
        subscription_id: subscriptionId,
        amount_minor: st.amountMinor || 0,
        currency: st.currency || sub.currency,
        gateway: sub.gateway,
        gateway_invoice_ref: sub.gateway_subscription_ref,
        coupon_id: sub.pending_coupon_id,
        period_start: new Date().toISOString(),
        period_end: end.toISOString(),
        status: "paid",
        paid_at: new Date().toISOString(),
      });

      return res.status(200).json({ status: "active", renewalMode: "manual" });
    }
    if (st.status === "failed") {
      await supabaseAdmin.from("subscriptions").update({ last_charge_failed_at: new Date().toISOString() }).eq("id", subscriptionId);
      await insertSubscriptionEvent(subscriptionId, "payment_failed", sub.status, sub.status, { reason: st.failureReason });
      return res.status(200).json({ status: "failed", reason: st.failureReason });
    }
    return res.status(200).json({ status: "pending" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verify failed";
    return res.status(500).json({ error: msg });
  }
}