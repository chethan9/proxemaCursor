import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { tapGateway } from "@/lib/payments/tap";
import { logActivity } from "@/lib/activity-log";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.slice(7);
  const { data: ud, error: ue } = await supabaseAdmin.auth.getUser(token);
  if (ue || !ud.user) return res.status(401).json({ error: "Unauthorized" });

  const { subscriptionId, tokenId } = req.body as { subscriptionId?: string; tokenId?: string };
  if (!subscriptionId || !tokenId) return res.status(400).json({ error: "subscriptionId and tokenId required" });

  const { data: sub, error: se } = await supabaseAdmin
    .from("subscriptions")
    .select("id, client_id, currency, gateway, plans!subscriptions_plan_id_fkey(name, prices)")
    .eq("id", subscriptionId)
    .single();
  if (se || !sub) return res.status(404).json({ error: "Subscription not found" });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", ud.user.id)
    .single();

  const plan = sub.plans as { name?: string; prices?: Record<string, number> } | null;
  const currency = sub.currency || "USD";
  const amountMinor = plan?.prices?.[currency] ?? 0;
  if (!amountMinor) return res.status(400).json({ error: `No price configured for ${currency}` });

  if (!tapGateway.isConfigured()) return res.status(503).json({ error: "Tap gateway not configured" });

  const host = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
  try {
    const init = await tapGateway.initiateCharge({
      amountMinor,
      currency,
      description: `${plan?.name || "Plan"} subscription`,
      customerEmail: profile?.email || ud.user.email || "",
      customerName: profile?.full_name || undefined,
      clientReference: `sub_${subscriptionId}_${Date.now()}`,
      returnUrl: `${host}/billing/return?sub=${subscriptionId}&gateway=tap`,
      sourceToken: tokenId,
    });

    await supabaseAdmin
      .from("subscriptions")
      .update({
        gateway: "tap",
        gateway_subscription_ref: init.gatewayRef,
        last_charge_attempt_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    await logActivity({
      action: "tap.charge.initiated",
      entityType: "payment_gateway",
      entityId: init.gatewayRef,
      clientId: sub.client_id,
      metadata: { subscription_id: subscriptionId, gateway: "tap", amount_minor: amountMinor, currency, status: "pending" },
      actorType: "user",
      req,
    });

    const payload = init.payload as { type: string; transactionUrl?: string };
    return res.status(200).json({
      gatewayRef: init.gatewayRef,
      status: init.status,
      transactionUrl: payload?.transactionUrl || null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Tap charge failed";
    await logActivity({
      action: "tap.charge.failed",
      entityType: "payment_gateway",
      clientId: sub.client_id,
      metadata: { subscription_id: subscriptionId, gateway: "tap", error: msg },
      actorType: "user",
      req,
    });
    return res.status(502).json({ error: msg });
  }
}
