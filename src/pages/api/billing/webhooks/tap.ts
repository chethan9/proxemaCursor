import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertContentLength, MAX_WEBHOOK_RAW_BYTES } from "@/lib/api/validation";
import { tapGateway } from "@/lib/payments/tap";
import { logActivity } from "@/lib/activity-log";
import { recordPaidConversion, recordReversal } from "@/services/referralService.server";
import { finalizeCheckoutPayment } from "@/lib/billing/finalize-checkout-payment.server";
import { tryFinalizeAiCreditPurchaseFromWebhook } from "@/lib/billing/finalize-ai-credit-purchase.server";

export const config = { api: { bodyParser: false } };

async function getRawBody(req: NextApiRequest, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    req.on("data", (chunk: Buffer | string) => {
      const buf = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
      bytes += buf.length;
      if (bytes > maxBytes) {
        reject(new Error("payload too large"));
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  if (!assertContentLength(req, MAX_WEBHOOK_RAW_BYTES)) {
    return res.status(413).json({ error: "Payload too large" });
  }

  let rawBody: string;
  try {
    rawBody = await getRawBody(req, MAX_WEBHOOK_RAW_BYTES);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "payload too large") return res.status(413).json({ error: "Payload too large" });
    throw e;
  }
  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { return res.status(400).json({ error: "Invalid JSON" }); }

  try {
    const event = await tapGateway.parseWebhook({
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
        gateway: "tap",
        paymentStatus: ps,
      });
      if (handled) {
        return res.status(200).json({ ok: true, purpose: "ai_credits" });
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
            console.warn("[tap webhook] finalize failed", finErr);
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
          amountMinor: event.amountMinor,
          currency: event.currency,
          source: "webhook:tap",
          sourceRef: event.id,
          metadata: { gateway_ref: event.gatewayRef, gateway: "tap" },
        });
      } catch (refErr) {
        console.warn("[tap webhook] referral conversion failed", refErr);
      }
    } else if (event.paymentStatus === "refunded") {
      try {
        await recordReversal({
          source: "webhook:tap",
          sourceRefPrefix: event.id,
          reason: "refund_via_tap_webhook",
        });
      } catch (refErr) {
        console.warn("[tap webhook] referral reversal failed", refErr);
      }
    }

    await logActivity({
      action: `tap.webhook.${event.paymentStatus || event.type}`,
      entityType: "payment_gateway",
      entityId: event.gatewayRef,
      clientId,
      metadata: {
        gateway: "tap",
        status: event.paymentStatus,
        event_id: event.id,
        amount_minor: event.amountMinor,
        currency: event.currency,
      },
      actorType: "system",
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook error";
    await logActivity({
      action: "tap.webhook.invalid",
      entityType: "payment_gateway",
      metadata: { gateway: "tap", error: msg, raw_body_length: rawBody.length },
      actorType: "system",
    });
    return res.status(400).json({ error: msg });
  }
}
