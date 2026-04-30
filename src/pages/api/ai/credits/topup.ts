import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getGateway } from "@/lib/payments";
import type { GatewayName } from "@/lib/payments/types";
import { getResolvedGatewayForCountry } from "@/lib/payments/gateway-routing.server";

const MIN_CREDITS = 10;
const MAX_CREDITS = 50_000;

function priceMinorPerCredit(): number {
  const n = parseInt(process.env.AI_CREDIT_PRICE_MINOR_PER_UNIT || "10", 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: ud } = await supa.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: "Unauthorized" });

  const body = req.body as { credits?: number };
  const credits = typeof body.credits === "number" ? Math.floor(body.credits) : NaN;
  if (!Number.isFinite(credits) || credits < MIN_CREDITS || credits > MAX_CREDITS) {
    return res.status(400).json({ error: `Credits must be between ${MIN_CREDITS} and ${MAX_CREDITS}` });
  }

  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id, email, full_name").eq("id", ud.user.id).maybeSingle();
  const clientId = profile?.client_id as string | undefined;
  if (!clientId) return res.status(400).json({ error: "No client" });

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, currency, gateway, status")
    .eq("client_id", clientId)
    .in("status", ["trialing", "active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return res.status(400).json({ error: "No active subscription" });

  const { data: cli } = await supabaseAdmin.from("clients").select("country, currency").eq("id", clientId).maybeSingle();
  const currency = sub.currency || cli?.currency || "USD";
  const ppm = priceMinorPerCredit();
  const amountMinor = credits * ppm;

  const { data: purchase, error: insErr } = await supabaseAdmin
    .from("ai_credit_purchases")
    .insert({
      client_id: clientId,
      subscription_id: sub.id,
      credits,
      amount_minor: amountMinor,
      currency,
      status: "pending",
      metadata: { purpose: "ai_credits" },
    })
    .select("id")
    .single();

  if (insErr || !purchase) return res.status(500).json({ error: insErr?.message || "Could not create purchase" });

  const routedGw = await getResolvedGatewayForCountry(cli?.country);
  const gatewayName = (routedGw || (sub.gateway as GatewayName) || "razorpay") as GatewayName;

  const host = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
  const returnUrl = `${host}/settings/ai-credits?ai_topup=1&purchase=${purchase.id}`;

  if (gatewayName === "tap") {
    return res.status(200).json({
      purchaseId: purchase.id,
      gateway: "tap",
      payload: {
        type: "tap-redirect-page",
        redirectUrl: `/billing/tap-ai-credits?purchase=${purchase.id}`,
      },
      amountMinor,
      currency,
    });
  }

  const gw = getGateway(gatewayName);
  try {
    const init = await gw.initiateCharge({
      amountMinor,
      currency,
      description: `AI image credits (${credits})`,
      customerEmail: profile?.email || ud.user.email || "",
      customerName: profile?.full_name || undefined,
      clientReference: `ai_credit_${purchase.id}`,
      returnUrl,
    });

    await supabaseAdmin
      .from("ai_credit_purchases")
      .update({
        gateway: gatewayName,
        gateway_ref: init.gatewayRef,
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchase.id);

    return res.status(200).json({
      purchaseId: purchase.id,
      gateway: init.gateway,
      payload: init.payload,
      amountMinor,
      currency,
    });
  } catch (e) {
    await supabaseAdmin.from("ai_credit_purchases").update({ status: "failed" }).eq("id", purchase.id);
    return res.status(502).json({ error: e instanceof Error ? e.message : "Gateway error" });
  }
}
