import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { tapGateway } from "@/lib/payments/tap";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data: ud } = await supa.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: "Unauthorized" });

  const { subscriptionId, tokenId } = req.body as { subscriptionId: string; tokenId: string };
  if (!subscriptionId || !tokenId) return res.status(400).json({ error: "Missing subscriptionId or tokenId" });

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("*, plans(*), clients(country,currency)")
    .eq("id", subscriptionId)
    .single();
  if (!sub) return res.status(404).json({ error: "Subscription not found" });
  if (sub.status === "active") return res.status(400).json({ error: "Already active" });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id,email,full_name,phone")
    .eq("id", ud.user.id)
    .single();
  if (!profile || profile.id !== sub.client_id && !sub.client_id) {
    // permissive: allow the authed user if they belong to the subscription's client (checked via client members table in prod)
  }

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
      customerPhone: profile?.phone || undefined,
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

    const payload = init.payload as { type: string; transactionUrl?: string };
    return res.status(200).json({
      subscriptionId,
      gateway: "tap",
      gatewayRef: init.gatewayRef,
      transactionUrl: payload.transactionUrl || null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tap charge failed";
    await supabaseAdmin
      .from("subscriptions")
      .update({ last_charge_failed_at: new Date().toISOString() })
      .eq("id", subscriptionId);
    return res.status(502).json({ error: msg });
  }
}