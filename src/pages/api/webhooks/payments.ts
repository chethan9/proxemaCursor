import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { logActivity } from "@/lib/activity-log";
import { getGateway } from "@/lib/payments";
import type { GatewayName, WebhookEvent } from "@/lib/payments/types";

export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function detectGateway(req: NextApiRequest, rawBody: string): GatewayName | null {
  const q = (req.query.gateway as string | undefined)?.toLowerCase();
  if (q === "myfatoorah" || q === "razorpay" || q === "tap") return q;

  const headers = req.headers;
  if (headers["x-razorpay-signature"] || headers["X-Razorpay-Signature" as never]) return "razorpay";
  if (headers["mfsignature"] || headers["MFSignature" as never]) return "myfatoorah";

  try {
    const body = JSON.parse(rawBody);
    if (body?.hashstring && body?.id && (body?.transaction || body?.source)) return "tap";
    if (body?.event && typeof body.event === "string" && body.event.startsWith("payment.")) return "razorpay";
    if (body?.Data?.InvoiceId || body?.EventType?.startsWith?.("Transaction")) return "myfatoorah";
  } catch {
    // not json
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const rawBody = await readRawBody(req);
  const gatewayName = detectGateway(req, rawBody);

  if (!gatewayName) {
    await logActivity({
      action: "webhook.unknown_gateway",
      entityType: "payment_gateway",
      metadata: { headers: Object.keys(req.headers), body_preview: rawBody.slice(0, 300) },
      actorType: "system",
    });
    return res.status(400).json({ error: "Unable to detect gateway. Pass ?gateway=myfatoorah|razorpay|tap or include the gateway's signature header." });
  }

  let event: WebhookEvent;
  try {
    const gw = getGateway(gatewayName);
    event = await gw.parseWebhook({ headers: req.headers as Record<string, string | string[] | undefined>, rawBody });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook parse failed";
    await logActivity({
      action: `${gatewayName}.webhook.invalid`,
      entityType: "payment_gateway",
      metadata: { gateway: gatewayName, error: msg, body_preview: rawBody.slice(0, 500) },
      actorType: "system",
    });
    return res.status(401).json({ error: msg });
  }

  let clientId: string | null = null;
  let subscriptionId: string | null = null;

  if (event.gatewayRef) {
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, client_id, status")
      .eq("gateway_subscription_ref", event.gatewayRef)
      .maybeSingle();

    if (sub) {
      clientId = sub.client_id;
      subscriptionId = sub.id;

      const updates: { status?: string; last_payment_at?: string } = {};
      if (event.paymentStatus === "paid") {
        updates.status = "active";
        updates.last_payment_at = new Date().toISOString();
      } else if (event.paymentStatus === "failed") {
        updates.status = "past_due";
      } else if (event.paymentStatus === "canceled") {
        updates.status = "canceled";
      } else if (event.paymentStatus === "refunded") {
        updates.status = "canceled";
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from("subscriptions").update(updates as never).eq("id", sub.id);
      }
    }
  }

  await logActivity({
    action: `${gatewayName}.webhook.${event.paymentStatus || event.type || "received"}`,
    entityType: "payment_gateway",
    entityId: event.gatewayRef || subscriptionId,
    clientId,
    metadata: {
      gateway: gatewayName,
      event_id: event.id,
      event_type: event.type,
      payment_status: event.paymentStatus,
      amount_minor: event.amountMinor,
      currency: event.currency,
      subscription_id: subscriptionId,
    },
    actorType: "system",
  });

  return res.status(200).json({
    received: true,
    gateway: gatewayName,
    event_id: event.id,
    subscription_updated: Boolean(subscriptionId),
  });
}
