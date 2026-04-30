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

  const { purchaseId, tokenId } = req.body as { purchaseId?: string; tokenId?: string };
  if (!purchaseId || !tokenId) return res.status(400).json({ error: "purchaseId and tokenId required" });

  const { data: purchase, error: pe } = await supabaseAdmin
    .from("ai_credit_purchases")
    .select("id, client_id, subscription_id, credits, amount_minor, currency, status")
    .eq("id", purchaseId)
    .single();
  if (pe || !purchase || purchase.status !== "pending") return res.status(404).json({ error: "Purchase not found" });

  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id, email, full_name").eq("id", ud.user.id).single();
  if (profile?.client_id !== purchase.client_id) return res.status(403).json({ error: "Forbidden" });

  const amountMinor = purchase.amount_minor;
  const currency = purchase.currency || "USD";
  if (!amountMinor) return res.status(400).json({ error: "Invalid purchase amount" });

  if (!tapGateway.isConfigured()) return res.status(503).json({ error: "Tap gateway not configured" });

  const host = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
  try {
    const init = await tapGateway.initiateCharge({
      amountMinor,
      currency,
      description: `AI credits (${purchase.credits})`,
      customerEmail: profile?.email || ud.user.email || "",
      customerName: profile?.full_name || undefined,
      clientReference: `ai_credit_${purchaseId}_${Date.now()}`,
      returnUrl: `${host}/settings/ai-credits?ai_topup=1&purchase=${purchaseId}&gateway=tap`,
      sourceToken: tokenId,
    });

    await supabaseAdmin
      .from("ai_credit_purchases")
      .update({
        gateway: "tap",
        gateway_ref: init.gatewayRef,
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchaseId);

    await logActivity({
      action: "ai_credits.tap_charge.initiated",
      entityType: "ai_credit_purchases",
      entityId: purchaseId,
      clientId: purchase.client_id,
      metadata: { gateway: "tap", amount_minor: amountMinor, currency },
      actorType: "user",
      req,
    });

    const payload = init.payload as { type?: string; transactionUrl?: string };
    return res.status(200).json({
      gatewayRef: init.gatewayRef,
      transactionUrl: payload?.transactionUrl || null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Tap charge failed";
    await logActivity({
      action: "ai_credits.tap_charge.failed",
      entityType: "ai_credit_purchases",
      entityId: purchaseId,
      clientId: purchase.client_id,
      metadata: { gateway: "tap", error: msg },
      actorType: "user",
      req,
    });
    return res.status(502).json({ error: msg });
  }
}
