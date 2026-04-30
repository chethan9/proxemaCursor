import type { NextApiRequest, NextApiResponse } from "next";
import { myFatoorahGateway } from "@/lib/payments/myfatoorah";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { recordPaidConversion, recordReversal } from "@/services/referralService.server";
import { finalizeCheckoutPayment } from "@/lib/billing/finalize-checkout-payment.server";
import { tryFinalizeAiCreditPurchaseFromWebhook } from "@/lib/billing/finalize-ai-credit-purchase.server";

export const config = {
  api: { bodyParser: false },
};

async function readRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let rawBody = "";
  try {
    rawBody = await readRawBody(req);
    const event = await myFatoorahGateway.parseWebhook({
      headers: req.headers as Record<string, string | string[] | undefined>,
      rawBody,
    });

    if (event.gatewayRef) {
      const ps =
        event.paymentStatus === "paid"
          ? "paid"
          : event.paymentStatus === "failed"
            ? "failed"
            : event.paymentStatus === "canceled"
              ? "canceled"
              : "pending";
      const { handled } = await tryFinalizeAiCreditPurchaseFromWebhook({
        gatewayRef: event.gatewayRef,
        gateway: "myfatoorah",
        paymentStatus: ps,
      });
      if (handled) {
        return res.status(200).json({ received: true, eventId: event.id, purpose: "ai_credits" });
      }
    }

    let clientId: string | null = null;
    let subscriptionId: string | null = null;
    if (event.gatewayRef) {
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("id, client_id")
        .eq("gateway_subscription_ref", event.gatewayRef)
        .maybeSingle();
      if (sub) {
        clientId = sub.client_id;
        subscriptionId = sub.id;
        if (event.paymentStatus === "paid") {
          try {
            await finalizeCheckoutPayment({
              subscriptionId: sub.id,
              amountMinor: event.amountMinor || 0,
              currency: event.currency || "USD",
              paymentMethodId: null,
            });
          } catch (finErr) {
            console.warn("[myfatoorah webhook] finalize failed", finErr);
          }
        } else if (event.paymentStatus === "failed" || event.paymentStatus === "canceled") {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "past_due",
              last_charge_failed_at: new Date().toISOString(),
            } as never)
            .eq("id", sub.id);
        }
      }
    }

    if (event.paymentStatus === "paid" && clientId && subscriptionId) {
      try {
        await recordPaidConversion({
          subscriptionId,
          clientId,
          amountMinor: event.amountMinor || 0,
          currency: event.currency || "USD",
          source: "webhook:myfatoorah",
          sourceRef: event.id,
          metadata: { gateway_ref: event.gatewayRef, gateway: "myfatoorah" },
        });
      } catch (refErr) {
        console.warn("[myfatoorah webhook] referral conversion failed", refErr);
      }
    } else if (event.paymentStatus === "refunded") {
      try {
        await recordReversal({
          source: "webhook:myfatoorah",
          sourceRefPrefix: event.id,
          reason: "refund_via_myfatoorah_webhook",
        });
      } catch (refErr) {
        console.warn("[myfatoorah webhook] referral reversal failed", refErr);
      }
    }

    await supabaseAdmin.from("activity_log" as never).insert({
      actor_type: "system",
      action: `webhook.${event.type}`,
      entity_type: "gateway_webhook",
      entity_id: event.gatewayRef,
      client_id: clientId,
      metadata: {
        module: "billing",
        gateway: "myfatoorah",
        event_id: event.id,
        payment_status: event.paymentStatus,
        amount_minor: event.amountMinor,
        currency: event.currency,
      },
    } as never);

    return res.status(200).json({ received: true, eventId: event.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook processing failed";
    if (msg.includes("signature")) return res.status(401).json({ error: msg });
    console.error("[myfatoorah webhook]", msg, { rawBody: rawBody.slice(0, 500) });
    return res.status(400).json({ error: msg });
  }
}
