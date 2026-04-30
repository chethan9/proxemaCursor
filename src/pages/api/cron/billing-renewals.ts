import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { logActivity } from "@/lib/activity-log";
import { getGateway } from "@/lib/payments";
import type { GatewayName } from "@/lib/payments/types";

const RETRY_DAYS = [0, 3, 5, 7];
const DAY_MS = 86400_000;

type Sub = Record<string, unknown> & {
  id: string;
  client_id: string;
  status: string;
  renewal_mode?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  trial_end?: string | null;
  payment_method_id?: string | null;
  last_charge_attempt_at?: string | null;
  grace_period_days?: number | null;
  currency?: string;
  gateway?: string | null;
  plans?: Record<string, unknown> | null;
};

type SavedPaymentMethod = {
  id: string;
  client_id: string;
  gateway: GatewayName;
  gateway_token: string;
  recurring_eligible: boolean;
};

/**
 * Off-session charge for a subscription with a saved payment method.
 *
 * Resolution order:
 *   1. Load `client_payment_methods` row referenced by `sub.payment_method_id`.
 *   2. Resolve the gateway adapter (sub.gateway falls back to PM.gateway).
 *   3. If the adapter exposes `chargeSavedSource`, attempt the charge.
 *   4. Otherwise return a roadmap-aligned stub (`recurring_not_implemented`)
 *      so the cron treats the row consistently and the integration point is
 *      explicit per gateway.
 */
async function chargeSavedToken(sub: Sub): Promise<{ ok: boolean; error?: string; gatewayRef?: string }> {
  if (!sub.payment_method_id) {
    return { ok: false, error: "no_payment_method" };
  }

  const { data: pmRow } = await (supabaseAdmin as any)
    .from("client_payment_methods")
    .select("id, client_id, gateway, gateway_token, recurring_eligible")
    .eq("id", sub.payment_method_id)
    .maybeSingle();
  const pm = pmRow as SavedPaymentMethod | null;

  if (!pm) return { ok: false, error: "payment_method_missing" };
  if (pm.client_id !== sub.client_id) return { ok: false, error: "payment_method_client_mismatch" };
  if (!pm.recurring_eligible) return { ok: false, error: "payment_method_not_recurring_eligible" };

  const gatewayName = ((sub.gateway as GatewayName) || pm.gateway) as GatewayName;
  let adapter;
  try {
    adapter = getGateway(gatewayName);
  } catch {
    return { ok: false, error: `unknown_gateway:${gatewayName}` };
  }

  if (!adapter.isConfigured()) {
    return { ok: false, error: `gateway_not_configured:${gatewayName}` };
  }

  if (typeof adapter.chargeSavedSource !== "function") {
    return { ok: false, error: `recurring_not_implemented:${gatewayName}` };
  }

  const plan = (sub.plans || {}) as { name?: string; prices?: Record<string, number> };
  const currency = sub.currency || "USD";
  const amount = plan.prices?.[currency] ?? 0;
  if (!amount) return { ok: false, error: "no_price_for_currency" };

  try {
    const result = await adapter.chargeSavedSource({
      amountMinor: Math.round(amount * 100),
      currency,
      description: `${plan.name || "Plan"} renewal`,
      customerEmail: "",
      clientReference: `sub_${sub.id}_${Date.now()}`,
      savedToken: pm.gateway_token,
    });
    if (result.ok) return { ok: true, gatewayRef: result.gatewayRef };
    return { ok: false, error: result.errorCode || "gateway_declined", gatewayRef: result.gatewayRef };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `gateway_error:${e.message}` : "gateway_error" };
  }
}

async function logEvent(subId: string, eventType: string, fromStatus: string | null, toStatus: string | null, metadata?: Record<string, unknown>) {
  await (supabaseAdmin as any).from("subscription_events").insert({
    subscription_id: subId,
    event_type: eventType,
    from_status: fromStatus,
    to_status: toStatus,
    metadata: metadata || {},
  });
}

async function setStatus(subId: string, newStatus: string, extra: Record<string, unknown> = {}) {
  await (supabaseAdmin as any).from("subscriptions").update({
    status: newStatus,
    ...extra,
    updated_at: new Date().toISOString(),
  }).eq("id", subId);
}

function extendPeriod(sub: Sub): { current_period_start: string; current_period_end: string } {
  const plan = (sub.plans || {}) as { billing_interval?: string };
  const start = sub.current_period_end || new Date().toISOString();
  const d = new Date(start);
  if (plan.billing_interval === "year") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return { current_period_start: start, current_period_end: d.toISOString() };
}

async function createInvoice(sub: Sub, status: "pending" | "paid" | "failed", gatewayRef?: string) {
  const plan = (sub.plans || {}) as { prices?: Record<string, number> };
  const currency = sub.currency || "USD";
  const price = plan.prices?.[currency] || 0;
  const period = extendPeriod(sub);
  await (supabaseAdmin as any).from("invoices").insert({
    client_id: sub.client_id,
    subscription_id: sub.id,
    invoice_number: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`,
    amount_minor: Math.round(price * 100),
    currency,
    status,
    period_start: period.current_period_start,
    period_end: period.current_period_end,
    gateway: sub.gateway || null,
    gateway_invoice_ref: gatewayRef || null,
    paid_at: status === "paid" ? new Date().toISOString() : null,
  });
}

async function sysLog(sub: Sub, action: string, metadata?: Record<string, unknown>) {
  await logActivity({
    action,
    entityType: "subscription",
    entityId: sub.id,
    clientId: sub.client_id,
    actorType: "system",
    metadata,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const startedAt = new Date();
  const now = startedAt;
  const iso = now.toISOString();
  const hourAgo = new Date(now.getTime() - 3600_000).toISOString();

  const summary = {
    trials_ended: 0,
    trials_converted: 0,
    trials_charge_failed: 0,
    auto_renewed: 0,
    auto_failed: 0,
    manual_invoiced: 0,
    manual_overdue: 0,
    retried: 0,
    recovered: 0,
    locked: 0,
    canceled_scheduled: 0,
    canceled_abandoned: 0,
  };

  // 1. Trials ending — no PM → past_due; with PM → attempt charge (gateway-aware) → active or past_due
  const { data: trials } = await (supabaseAdmin as any).from("subscriptions")
    .select("id, client_id, trial_end, payment_method_id, status, gateway, currency, plans(*)")
    .eq("status", "trialing").lte("trial_end", iso);
  for (const s of (trials || []) as Sub[]) {
    if (!s.payment_method_id) {
      await setStatus(s.id, "past_due", { last_charge_failed_at: iso });
      await logEvent(s.id, "trial_ended_no_pm", "trialing", "past_due");
      await sysLog(s, "subscription.trial_ended");
      summary.trials_ended++;
      continue;
    }
    const charge = await chargeSavedToken(s);
    if (charge.ok) {
      const period = extendPeriod(s);
      await setStatus(s.id, "active", { ...period, trial_end: null, last_charge_attempt_at: iso, last_charge_failed_at: null });
      await createInvoice(s, "paid", charge.gatewayRef);
      await logEvent(s.id, "trial_converted", "trialing", "active", { gatewayRef: charge.gatewayRef });
      await sysLog(s, "subscription.trial_converted");
      summary.trials_converted++;
    } else {
      await setStatus(s.id, "past_due", { last_charge_attempt_at: iso, last_charge_failed_at: iso });
      await logEvent(s.id, "trial_charge_failed", "trialing", "past_due", { error: charge.error });
      await sysLog(s, "subscription.trial_charge_failed", { error: charge.error });
      summary.trials_charge_failed++;
    }
  }

  // 2a. Auto renewals due
  const { data: autoDue } = await (supabaseAdmin as any).from("subscriptions")
    .select("*, plans(*)").eq("status", "active").eq("renewal_mode", "auto").lte("current_period_end", iso);
  for (const s of (autoDue || []) as Sub[]) {
    const charge = await chargeSavedToken(s);
    if (charge.ok) {
      const period = extendPeriod(s);
      await setStatus(s.id, "active", { ...period, last_charge_attempt_at: iso, last_charge_failed_at: null });
      await createInvoice(s, "paid", charge.gatewayRef);
      await logEvent(s.id, "renewed", "active", "active");
      await sysLog(s, "subscription.renewed");
      summary.auto_renewed++;
    } else {
      await setStatus(s.id, "past_due", { last_charge_attempt_at: iso, last_charge_failed_at: iso });
      await createInvoice(s, "failed");
      await logEvent(s.id, "payment_failed", "active", "past_due", { error: charge.error });
      await sysLog(s, "subscription.payment_failed", { error: charge.error });
      summary.auto_failed++;
    }
  }

  // 2b. Manual renewals upcoming (period_end in ~3 days) — create unpaid invoice idempotently
  const in3 = new Date(now.getTime() + 3 * DAY_MS);
  const in3Start = new Date(in3.toISOString().slice(0, 10) + "T00:00:00Z").toISOString();
  const in3End = new Date(in3.toISOString().slice(0, 10) + "T23:59:59Z").toISOString();
  const { data: manualSoon } = await (supabaseAdmin as any).from("subscriptions")
    .select("*, plans(*)").eq("status", "active").eq("renewal_mode", "manual")
    .gte("current_period_end", in3Start).lte("current_period_end", in3End);
  for (const s of (manualSoon || []) as Sub[]) {
    const { data: existing } = await (supabaseAdmin as any).from("invoices")
      .select("id").eq("subscription_id", s.id).eq("status", "pending")
      .gte("period_start", s.current_period_end || iso).maybeSingle();
    if (existing) continue;
    await createInvoice(s, "pending");
    await sysLog(s, "subscription.manual_invoiced");
    summary.manual_invoiced++;
  }

  // 2c. Manual renewals overdue → past_due (no paid invoice for upcoming period)
  const { data: manualOverdue } = await (supabaseAdmin as any).from("subscriptions")
    .select("*, plans(*)").eq("status", "active").eq("renewal_mode", "manual").lte("current_period_end", iso);
  for (const s of (manualOverdue || []) as Sub[]) {
    const { data: paid } = await (supabaseAdmin as any).from("invoices")
      .select("id").eq("subscription_id", s.id).eq("status", "paid")
      .gte("period_start", s.current_period_end || iso).maybeSingle();
    if (paid) continue;
    await setStatus(s.id, "past_due", { last_charge_failed_at: iso });
    await logEvent(s.id, "manual_renewal_overdue", "active", "past_due");
    await sysLog(s, "subscription.manual_overdue");
    summary.manual_overdue++;
  }

  // 3. Past_due retries (auto) — on day 0/3/5/7 after period_end
  const { data: pastDueAuto } = await (supabaseAdmin as any).from("subscriptions")
    .select("*, plans(*)").eq("status", "past_due").eq("renewal_mode", "auto");
  for (const s of (pastDueAuto || []) as Sub[]) {
    if (!s.current_period_end) continue;
    const day = Math.floor((now.getTime() - new Date(s.current_period_end).getTime()) / DAY_MS);
    if (!RETRY_DAYS.includes(day)) continue;
    const alreadyToday = s.last_charge_attempt_at && s.last_charge_attempt_at.slice(0, 10) === iso.slice(0, 10);
    if (alreadyToday) continue;
    const charge = await chargeSavedToken(s);
    if (charge.ok) {
      const period = extendPeriod(s);
      await setStatus(s.id, "active", { ...period, last_charge_attempt_at: iso, last_charge_failed_at: null });
      await createInvoice(s, "paid", charge.gatewayRef);
      await logEvent(s.id, "renewed_after_retry", "past_due", "active", { day });
      await sysLog(s, "subscription.recovered", { day });
      summary.recovered++;
    } else {
      await setStatus(s.id, "past_due", { last_charge_attempt_at: iso, last_charge_failed_at: iso });
      await logEvent(s.id, "retry_failed", "past_due", "past_due", { day, error: charge.error });
      await sysLog(s, "subscription.retry_failed", { day });
      summary.retried++;
    }
  }

  // 4. Grace period expiry → locked
  const { data: pastDueAll } = await (supabaseAdmin as any).from("subscriptions")
    .select("id, client_id, current_period_end, grace_period_days, status").eq("status", "past_due");
  for (const s of (pastDueAll || []) as Sub[]) {
    if (!s.current_period_end) continue;
    const graceEnd = new Date(s.current_period_end);
    graceEnd.setDate(graceEnd.getDate() + (s.grace_period_days ?? 7));
    if (now > graceEnd) {
      await setStatus(s.id, "locked");
      await logEvent(s.id, "locked_grace_expired", "past_due", "locked");
      await sysLog(s, "subscription.locked");
      summary.locked++;
    }
  }

  // 5. Scheduled cancellations
  const { data: scheduled } = await (supabaseAdmin as any).from("subscriptions")
    .select("id, client_id, status").eq("cancel_at_period_end", true)
    .lte("current_period_end", iso).neq("status", "canceled");
  for (const s of (scheduled || []) as Sub[]) {
    await setStatus(s.id, "canceled", { canceled_at: iso });
    await logEvent(s.id, "scheduled_cancellation", s.status, "canceled");
    await sysLog(s, "subscription.canceled_scheduled");
    summary.canceled_scheduled++;
  }

  // 6. Abandoned checkouts cleanup
  const { data: abandoned } = await (supabaseAdmin as any).from("subscriptions")
    .select("id, client_id, status").eq("status", "pending_payment").lt("updated_at", hourAgo);
  for (const s of (abandoned || []) as Sub[]) {
    await setStatus(s.id, "canceled", { canceled_at: iso });
    await logEvent(s.id, "abandoned_checkout", "pending_payment", "canceled");
    await sysLog(s, "subscription.abandoned");
    summary.canceled_abandoned++;
  }

  await (supabaseAdmin as any).from("cron_logs").insert({
    job_type: "billing_renewals",
    status: "completed",
    message: `trials:${summary.trials_ended}+${summary.trials_converted}/${summary.trials_charge_failed} auto:${summary.auto_renewed}/${summary.auto_failed} manual:${summary.manual_invoiced}/${summary.manual_overdue} retry:${summary.retried} rec:${summary.recovered} locked:${summary.locked} cxl:${summary.canceled_scheduled}/${summary.canceled_abandoned}`,
    completed_at: iso,
    metadata: summary,
  });

  return res.status(200).json({
    ok: true,
    counts: summary,
    ts: iso,
    duration_ms: Date.now() - startedAt.getTime(),
  });
}