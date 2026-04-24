import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { tapGateway } from "@/lib/payments/tap";
import { logActivity } from "@/lib/activity-log";

export const config = { api: { bodyParser: false } };

async function getRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const rawBody = await getRawBody(req);
  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { return res.status(400).json({ error: "Invalid JSON" }); }

  try {
    const event = await tapGateway.parseWebhook({
      headers: req.headers as Record<string, string | string[] | undefined>,
      rawBody,
    });

    let clientId: string | null = null;
    if (event.gatewayRef) {
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("id, client_id")
        .eq("gateway_subscription_ref", event.gatewayRef)
        .maybeSingle();
      if (sub) {
        clientId = sub.client_id;
        const updates: { status?: string; last_payment_at?: string } = {};
        if (event.paymentStatus === "paid") {
          updates.status = "active";
          updates.last_payment_at = new Date().toISOString();
        } else if (event.paymentStatus === "failed" || event.paymentStatus === "canceled") {
          updates.status = "past_due";
        }
        if (Object.keys(updates).length > 0) {
          await supabaseAdmin.from("subscriptions").update(updates as never).eq("id", sub.id);
        }
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
