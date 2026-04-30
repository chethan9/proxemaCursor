import { supabaseAdmin } from "@/integrations/supabase/admin";
import { logActivity } from "@/lib/activity-log";
import type { Tables } from "@/integrations/supabase/helpers";

export type ReferralSettings = Tables<"referral_settings">;
export type ReferralProfile = Tables<"referral_profiles">;
export type ReferralAttribution = Tables<"referral_attributions">;
export type ReferralEvent = Tables<"referral_events">;
export type ReferralBalance = Tables<"referral_balances">;
export type ReferralPayoutRequest = Tables<"referral_payout_requests">;

let cachedSettings: { value: ReferralSettings; at: number } | null = null;
const SETTINGS_TTL_MS = 30_000;

export async function getReferralSettings(forceRefresh = false): Promise<ReferralSettings> {
  if (!forceRefresh && cachedSettings && Date.now() - cachedSettings.at < SETTINGS_TTL_MS) {
    return cachedSettings.value;
  }
  const { data, error } = await supabaseAdmin
    .from("referral_settings")
    .select("*")
    .eq("id", "singleton")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("referral_settings singleton missing");
  cachedSettings = { value: data, at: Date.now() };
  return data;
}

export function clearReferralSettingsCache() {
  cachedSettings = null;
}

function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}

export async function findProfileByCode(code: string): Promise<ReferralProfile | null> {
  const c = normalizeCode(code);
  if (!c) return null;
  const { data, error } = await supabaseAdmin
    .from("referral_profiles")
    .select("*")
    .ilike("referral_code", c)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function findProfileByClientId(clientId: string): Promise<ReferralProfile | null> {
  const { data, error } = await supabaseAdmin
    .from("referral_profiles")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function findAttributionForReferred(referredClientId: string): Promise<ReferralAttribution | null> {
  const { data, error } = await supabaseAdmin
    .from("referral_attributions")
    .select("*")
    .eq("referred_client_id", referredClientId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function ensureReferralProfile(opts: {
  clientId: string;
  userId: string;
}): Promise<ReferralProfile> {
  const settings = await getReferralSettings();
  if (!settings.is_enabled) {
    throw new Error("referral_program_disabled");
  }
  const existing = await findProfileByClientId(opts.clientId);
  if (existing) return existing;

  const { data: gen, error: genErr } = await supabaseAdmin.rpc("generate_referral_code", { p_seed: opts.clientId });
  if (genErr) throw genErr;
  const code = String(gen || "").toUpperCase();
  const { data, error } = await supabaseAdmin
    .from("referral_profiles")
    .insert({ client_id: opts.clientId, user_id: opts.userId, referral_code: code, status: "active" })
    .select("*")
    .single();
  if (error) throw error;
  await logActivity({
    action: "referral.profile.enrolled",
    entityType: "referral_profile",
    entityId: data.id,
    clientId: opts.clientId,
    metadata: { referral_code: data.referral_code },
    actorType: "system",
  });
  return data;
}

/**
 * Resolve a referral code at signup time and persist `referred_by` link.
 * Idempotent: a referred client can only be attributed once.
 */
export async function applyAttribution(opts: {
  code: string;
  referredClientId: string;
  metadata?: Record<string, unknown>;
}): Promise<ReferralAttribution | null> {
  const settings = await getReferralSettings();
  if (!settings.is_enabled) return null;

  const existing = await findAttributionForReferred(opts.referredClientId);
  if (existing) return existing;

  const profile = await findProfileByCode(opts.code);
  if (!profile) return null;
  if (profile.client_id === opts.referredClientId) return null;

  const insertRow = {
    referrer_client_id: profile.client_id,
    referred_client_id: opts.referredClientId,
    referral_code: profile.referral_code,
    signup_at: new Date().toISOString(),
    metadata: (opts.metadata as never) ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from("referral_attributions")
    .insert(insertRow)
    .select("*")
    .single();
  if (error) {
    // Concurrent insert — re-read.
    if (error.code === "23505") {
      return findAttributionForReferred(opts.referredClientId);
    }
    throw error;
  }

  await logActivity({
    action: "referral.attribution.created",
    entityType: "referral_attribution",
    entityId: data.id,
    clientId: profile.client_id,
    metadata: {
      referral_code: profile.referral_code,
      referred_client_id: opts.referredClientId,
    },
    actorType: "system",
  });

  return data;
}

interface PaidConversionInput {
  /** Subscription that just transitioned to a paid charge. */
  subscriptionId: string;
  /** The client who paid. */
  clientId: string;
  /** Charge amount in minor units. */
  amountMinor: number;
  /** Charge currency. */
  currency: string;
  /** Webhook source name (e.g. 'webhook:tap'). */
  source: string;
  /** Idempotency key from the webhook event. */
  sourceRef: string;
  /** Whether this is the first paid event for this subscription/customer. */
  isFirstPaid?: boolean;
  /** Extra metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Record referral reward(s) when a client makes a successful paid charge.
 * - Marks the paying client's own referral profile as eligible to withdraw.
 * - If the paying client was referred, credits the referrer with bonus + percentage.
 * - Idempotent on (source, source_ref).
 */
export async function recordPaidConversion(input: PaidConversionInput): Promise<void> {
  const settings = await getReferralSettings();
  if (!settings.is_enabled) return;
  if (!input.amountMinor || input.amountMinor <= 0) return;

  // Mark paying client's own enrollment as paid (so they can request payouts).
  await markReferrerPaid({ clientId: input.clientId, paidAt: new Date() });

  const attribution = await findAttributionForReferred(input.clientId);
  if (!attribution) return;

  // Eligibility window: only credit if the conversion happens within window of attribution.
  if (settings.eligibility_window_days > 0 && attribution.signup_at) {
    const cutoff = new Date(attribution.signup_at);
    cutoff.setDate(cutoff.getDate() + settings.eligibility_window_days);
    if (new Date() > cutoff && !attribution.converted) {
      // Past window for the first conversion.
      await logActivity({
        action: "referral.conversion.window_expired",
        entityType: "referral_attribution",
        entityId: attribution.id,
        clientId: attribution.referrer_client_id,
        metadata: { eligibility_window_days: settings.eligibility_window_days },
        actorType: "system",
      });
      return;
    }
  }

  const isFirstConversion = !attribution.converted;
  const eventsToInsert: Array<{
    referrer_client_id: string;
    referred_client_id: string | null;
    attribution_id: string;
    event_type: "signup_bonus" | "paid_conversion" | "recurring_bonus";
    amount_minor: number;
    currency: string;
    source: string;
    source_ref: string;
    subscription_id: string | null;
    reason: string | null;
    metadata: Record<string, unknown>;
  }> = [];

  // Signup bonus: credited only on the first conversion.
  if (isFirstConversion && settings.signup_bonus_minor > 0) {
    eventsToInsert.push({
      referrer_client_id: attribution.referrer_client_id,
      referred_client_id: attribution.referred_client_id,
      attribution_id: attribution.id,
      event_type: "signup_bonus",
      amount_minor: settings.signup_bonus_minor,
      currency: settings.payout_currency,
      source: input.source,
      source_ref: `${input.sourceRef}:signup_bonus`,
      subscription_id: input.subscriptionId,
      reason: "First paid conversion bonus",
      metadata: { ...(input.metadata || {}), attribution_id: attribution.id },
    });
  }

  // Percentage of the paid amount.
  if (settings.paid_percentage_bps > 0) {
    let percentMinor = Math.floor((input.amountMinor * settings.paid_percentage_bps) / 10000);
    if (settings.paid_percentage_max_minor != null && settings.paid_percentage_max_minor > 0) {
      percentMinor = Math.min(percentMinor, settings.paid_percentage_max_minor);
    }
    if (percentMinor > 0) {
      const eventType: "paid_conversion" | "recurring_bonus" = isFirstConversion ? "paid_conversion" : "recurring_bonus";
      // For recurring, only credit if recurring_max_count not exceeded yet.
      if (eventType === "recurring_bonus" && settings.recurring_max_count > 0) {
        const { count } = await supabaseAdmin
          .from("referral_events")
          .select("id", { count: "exact", head: true })
          .eq("attribution_id", attribution.id)
          .eq("event_type", "recurring_bonus")
          .eq("status", "posted");
        if ((count ?? 0) >= settings.recurring_max_count) {
          // Hit recurring cap; skip but don't fail.
          return;
        }
      } else if (eventType === "recurring_bonus" && settings.recurring_percentage_bps > 0) {
        // Recompute using recurring rate when available.
        let recurringMinor = Math.floor((input.amountMinor * settings.recurring_percentage_bps) / 10000);
        if (settings.paid_percentage_max_minor != null && settings.paid_percentage_max_minor > 0) {
          recurringMinor = Math.min(recurringMinor, settings.paid_percentage_max_minor);
        }
        percentMinor = recurringMinor;
        if (percentMinor <= 0) {
          // No recurring share configured.
          if (eventsToInsert.length === 0) return;
        }
      } else if (eventType === "recurring_bonus") {
        // Recurring not configured at all → skip.
        if (eventsToInsert.length === 0) return;
        percentMinor = 0;
      }

      if (percentMinor > 0) {
        eventsToInsert.push({
          referrer_client_id: attribution.referrer_client_id,
          referred_client_id: attribution.referred_client_id,
          attribution_id: attribution.id,
          event_type: eventType,
          amount_minor: percentMinor,
          currency: settings.payout_currency,
          source: input.source,
          source_ref: `${input.sourceRef}:${eventType}`,
          subscription_id: input.subscriptionId,
          reason: eventType === "paid_conversion"
            ? "Percentage of first paid charge"
            : "Percentage of recurring paid charge",
          metadata: {
            ...(input.metadata || {}),
            attribution_id: attribution.id,
            charge_amount_minor: input.amountMinor,
            charge_currency: input.currency,
            percentage_bps: eventType === "paid_conversion" ? settings.paid_percentage_bps : settings.recurring_percentage_bps,
          },
        });
      }
    }
  }

  if (eventsToInsert.length === 0 && !isFirstConversion) return;

  for (const evt of eventsToInsert) {
    const { data, error } = await supabaseAdmin
      .from("referral_events")
      .insert(evt as never)
      .select("id")
      .maybeSingle();
    if (error && error.code !== "23505") {
      // Anything other than dup key is a real error.
      throw error;
    }
    if (data) {
      await logActivity({
        action: `referral.event.${evt.event_type}`,
        entityType: "referral_event",
        entityId: data.id,
        clientId: evt.referrer_client_id,
        metadata: {
          amount_minor: evt.amount_minor,
          currency: evt.currency,
          source: evt.source,
          source_ref: evt.source_ref,
        },
        actorType: "system",
      });
    }
  }

  if (isFirstConversion) {
    const { error: updErr } = await supabaseAdmin
      .from("referral_attributions")
      .update({
        converted: true,
        first_paid_at: new Date().toISOString(),
        first_paid_subscription_id: input.subscriptionId,
      })
      .eq("id", attribution.id)
      .eq("converted", false);
    if (updErr && updErr.code !== "23505") throw updErr;
  }
}

/**
 * Mark the paying client's referral profile (if enrolled) as eligible to
 * request a withdrawal, since they've now made at least one paid purchase.
 */
export async function markReferrerPaid(opts: { clientId: string; paidAt?: Date }): Promise<void> {
  const profile = await findProfileByClientId(opts.clientId);
  if (!profile) return;
  if (profile.has_paid_purchase) return;
  const paidAt = (opts.paidAt || new Date()).toISOString();
  await supabaseAdmin
    .from("referral_profiles")
    .update({ has_paid_purchase: true, first_paid_at: paidAt })
    .eq("id", profile.id)
    .eq("has_paid_purchase", false);
  await logActivity({
    action: "referral.profile.first_paid",
    entityType: "referral_profile",
    entityId: profile.id,
    clientId: profile.client_id,
    metadata: { first_paid_at: paidAt },
    actorType: "system",
  });
}

/**
 * Reverse a previously credited referral event (on refund / chargeback).
 * Will short-circuit if events for this source/source_ref have already been
 * reversed. Insert idempotent reversal events to preserve the audit trail.
 */
export async function recordReversal(opts: {
  source: string;
  sourceRefPrefix: string;
  reason?: string;
  actorUserId?: string | null;
}): Promise<void> {
  const { data: events, error } = await supabaseAdmin
    .from("referral_events")
    .select("*")
    .eq("source", opts.source)
    .like("source_ref", `${opts.sourceRefPrefix}:%`)
    .eq("status", "posted");
  if (error) throw error;
  if (!events || events.length === 0) return;

  for (const evt of events) {
    const reversalRef = `${evt.source_ref}:reversal`;
    const { data: existing } = await supabaseAdmin
      .from("referral_events")
      .select("id")
      .eq("source", opts.source)
      .eq("source_ref", reversalRef)
      .maybeSingle();
    if (existing) continue;

    const reversalRow = {
      referrer_client_id: evt.referrer_client_id,
      referred_client_id: evt.referred_client_id,
      attribution_id: evt.attribution_id,
      event_type: "reversal" as const,
      amount_minor: -Math.abs(evt.amount_minor),
      currency: evt.currency,
      status: "posted" as const,
      source: opts.source,
      source_ref: reversalRef,
      subscription_id: evt.subscription_id,
      reverses_event_id: evt.id,
      reason: opts.reason || "Reversal",
      metadata: { reverses: evt.id, source_event_type: evt.event_type },
      actor_user_id: opts.actorUserId ?? null,
    };
    const { data: ins, error: insErr } = await supabaseAdmin
      .from("referral_events")
      .insert(reversalRow as never)
      .select("id")
      .maybeSingle();
    if (insErr && insErr.code !== "23505") throw insErr;

    await supabaseAdmin
      .from("referral_events")
      .update({ status: "reversed" })
      .eq("id", evt.id)
      .eq("status", "posted");

    if (ins) {
      await logActivity({
        action: "referral.event.reversal",
        entityType: "referral_event",
        entityId: ins.id,
        clientId: evt.referrer_client_id,
        metadata: { reverses: evt.id, source_ref: reversalRef, reason: opts.reason || null },
        actorType: "system",
      });
    }
  }
}

/**
 * Lookup a referral_balance row, creating it if missing.
 */
export async function getOrCreateBalance(opts: { clientId: string; currency: string }): Promise<ReferralBalance> {
  const { data, error } = await supabaseAdmin
    .from("referral_balances")
    .select("*")
    .eq("referrer_client_id", opts.clientId)
    .eq("currency", opts.currency)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: ins, error: insErr } = await supabaseAdmin
    .from("referral_balances")
    .insert({ referrer_client_id: opts.clientId, currency: opts.currency })
    .select("*")
    .single();
  if (insErr) throw insErr;
  return ins;
}

/**
 * Recompute a balance row using the SQL helper. Useful for reconciliation.
 */
export async function recomputeBalance(opts: { clientId: string; currency: string }): Promise<void> {
  const { error } = await supabaseAdmin.rpc("recompute_referral_balance", {
    p_client_id: opts.clientId,
    p_currency: opts.currency,
  });
  if (error) throw error;
}
