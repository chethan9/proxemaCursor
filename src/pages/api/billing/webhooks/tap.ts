import type { NextApiRequest, NextApiResponse } from "next";
import { tapGateway } from "@/lib/payments/tap";
import { supabaseAdmin } from "@/integrations/supabase/admin";

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
    const event = await tapGateway.parseWebhook({
      headers: req.headers as Record<string, string | string[] | undefined>,
      rawBody,
    });

    await supabaseAdmin.from("activity_log" as never).insert({
      actor_type: "system",
      action: `webhook.${event.type}`,
      entity_type: "gateway_webhook",
      entity_id: event.gatewayRef,
      metadata: {
        gateway: "tap",
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
    console.error("[tap webhook]", msg, { rawBody: rawBody.slice(0, 500) });
    return res.status(400).json({ error: msg });
  }
}