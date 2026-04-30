import { supabaseAdmin } from "@/integrations/supabase/admin";
import { insertSubscriptionEvent } from "@/services/subscriptionService.server";

const DAY_MS = 86_400_000;

export type FinalizeCheckoutPaymentInput = {
  subscriptionId: string;
  amountMinor: number;
  currency: string;
  paymentMethodId?: string | null;
};

/**
 * Idempotent: if subscription is already active/trialing, returns that status without duplicating invoices.
 */
export async function finalizeCheckoutPayment(
  input: FinalizeCheckoutPaymentInput,
): Promise<{ status: "trialing" | "active" }> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("*, plans(*)")
    .eq("id", input.subscriptionId)
    .single();

  if (!sub) throw new Error("Subscription not found");

  if (sub.status === "active" || sub.status === "trialing") {
    return { status: sub.status as "trialing" | "active" };
  }

  const plan = sub.plans as { billing_interval?: string; trial_days?: number | null } | null;
  const trialDays = plan?.trial_days ?? 0;
  const now = new Date();
  const isoNow = now.toISOString();

  let nextStatus: "trialing" | "active";
  let trial_end: string | null;
  let current_period_end: string;

  if (trialDays > 0) {
    nextStatus = "trialing";
    const te = new Date(now.getTime() + trialDays * DAY_MS);
    trial_end = te.toISOString();
    current_period_end = trial_end;
  } else {
    nextStatus = "active";
    trial_end = null;
    const end = new Date(now);
    if (plan?.billing_interval === "year") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    current_period_end = end.toISOString();
  }

  await supabaseAdmin
    .from("subscriptions")
    .update({
      status: nextStatus,
      trial_end,
      current_period_start: isoNow,
      current_period_end,
      renewal_mode: "auto",
      auto_renew_disabled_reason: "tokenization_not_implemented",
      pending_coupon_id: null,
      quota_grace_until: null,
      payment_method_id: input.paymentMethodId ?? null,
      last_charge_failed_at: null,
      last_charge_attempt_at: isoNow,
      updated_at: isoNow,
    })
    .eq("id", input.subscriptionId);

  if (sub.pending_coupon_id) {
    await supabaseAdmin.from("coupon_redemptions").insert({
      coupon_id: sub.pending_coupon_id,
      client_id: sub.client_id,
      subscription_id: input.subscriptionId,
      discount_minor: input.amountMinor || 0,
      currency: input.currency || sub.currency,
    });
    await supabaseAdmin.rpc("increment_coupon_redemption_count", { coupon_id_in: sub.pending_coupon_id }).then(() => {}, () => {});
  }

  await insertSubscriptionEvent(input.subscriptionId, "payment_succeeded", sub.status, nextStatus, {
    gateway: sub.gateway,
    gatewayRef: sub.gateway_subscription_ref,
    amountMinor: input.amountMinor,
    currency: input.currency,
    couponId: sub.pending_coupon_id,
  });

  await supabaseAdmin.from("invoices").insert({
    invoice_number: `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 1e6)
      .toString()
      .padStart(6, "0")}`,
    client_id: sub.client_id,
    subscription_id: input.subscriptionId,
    amount_minor: input.amountMinor || 0,
    currency: input.currency || sub.currency,
    gateway: sub.gateway,
    gateway_invoice_ref: sub.gateway_subscription_ref,
    coupon_id: sub.pending_coupon_id,
    period_start: isoNow,
    period_end: current_period_end,
    status: "paid",
    paid_at: isoNow,
  });

  return { status: nextStatus };
}
