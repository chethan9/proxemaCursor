import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getGateway } from "@/lib/payments";
import type { GatewayName } from "@/lib/payments/types";
import { finalizeCheckoutPayment } from "@/lib/billing/finalize-checkout-payment.server";
import { insertSubscriptionEvent } from "@/services/subscriptionService.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { subscriptionId, tapChargeId } = req.body as { subscriptionId?: string; tapChargeId?: string };
  if (!subscriptionId) return res.status(400).json({ error: "Missing subscriptionId" });

  const { data: sub } = await supabaseAdmin.from("subscriptions").select("*, plans(*)").eq("id", subscriptionId).single();
  if (!sub) return res.status(404).json({ error: "Not found" });
  if (sub.status === "active" || sub.status === "trialing") {
    return res.status(200).json({ status: "already_active", subscription: sub });
  }

  let gatewayRef = sub.gateway_subscription_ref as string | null;
  if ((sub.gateway as string) === "tap" && tapChargeId) gatewayRef = tapChargeId;

  if (!sub.gateway || !gatewayRef) return res.status(400).json({ error: "No pending charge" });

  try {
    const gw = getGateway(sub.gateway as GatewayName);
    const st = await gw.getPaymentStatus(gatewayRef);
    if (st.status === "paid") {
      const result = await finalizeCheckoutPayment({
        subscriptionId,
        amountMinor: st.amountMinor,
        currency: st.currency || sub.currency,
        paymentMethodId: null,
      });
      return res.status(200).json({ status: result.status, renewalMode: "auto" });
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
