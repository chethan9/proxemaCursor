import { supabaseAdmin } from "@/integrations/supabase/admin";

export type WebhookPaymentStatus = "paid" | "failed" | "refunded" | "pending" | "canceled";

/**
 * When a payment gateway webhook references an AI credit top-up order, apply or fail it.
 * Checks `ai_credit_purchases.gateway_ref` — must run before subscription billing logic if refs could collide (we check purchases first in webhooks).
 */
export async function tryFinalizeAiCreditPurchaseFromWebhook(params: {
  gatewayRef: string;
  gateway: string;
  paymentStatus: WebhookPaymentStatus;
}): Promise<{ handled: boolean }> {
  const { gatewayRef, gateway, paymentStatus } = params;
  if (!gatewayRef) return { handled: false };

  const { data: purchase } = await supabaseAdmin
    .from("ai_credit_purchases")
    .select("id, status, credits, subscription_id")
    .eq("gateway_ref", gatewayRef)
    .maybeSingle();

  if (!purchase) return { handled: false };

  if (purchase.status !== "pending") {
    return { handled: true };
  }

  if (paymentStatus === "paid") {
    const { data: updated } = await supabaseAdmin
      .from("ai_credit_purchases")
      .update({
        status: "paid",
        gateway,
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchase.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!updated) return { handled: true };

    if (!purchase.subscription_id) return { handled: true };

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("ai_credits_topup_balance")
      .eq("id", purchase.subscription_id)
      .single();

    const next = (sub?.ai_credits_topup_balance ?? 0) + purchase.credits;
    await supabaseAdmin
      .from("subscriptions")
      .update({
        ai_credits_topup_balance: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchase.subscription_id);

    return { handled: true };
  }

  if (paymentStatus === "failed" || paymentStatus === "canceled" || paymentStatus === "refunded") {
    await supabaseAdmin
      .from("ai_credit_purchases")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", purchase.id)
      .eq("status", "pending");
    return { handled: true };
  }

  return { handled: true };
}
