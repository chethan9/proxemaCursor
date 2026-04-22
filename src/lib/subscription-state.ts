import type { Tables } from "@/integrations/supabase/types";

export type SubscriptionStatus = "pending_payment" | "trialing" | "active" | "past_due" | "locked" | "canceled";
export type RenewalMode = "auto" | "manual";

type Sub = Tables<"subscriptions">;

const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  pending_payment: ["trialing", "active", "canceled"],
  trialing: ["active", "past_due", "canceled"],
  active: ["past_due", "canceled"],
  past_due: ["active", "locked", "canceled"],
  locked: ["active", "canceled"],
  canceled: [],
};

export function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isActiveStatus(status: SubscriptionStatus | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

type AccessSub = Pick<Sub, "status" | "current_period_end" | "grace_period_days"> | null;

export function hasAccess(sub: AccessSub): boolean {
  if (!sub) return false;
  if (sub.status === "active" || sub.status === "trialing") return true;
  if (sub.status === "past_due" && sub.current_period_end) {
    const graceEnd = new Date(sub.current_period_end);
    graceEnd.setDate(graceEnd.getDate() + (sub.grace_period_days ?? 7));
    return new Date() < graceEnd;
  }
  return false;
}

export function daysUntilLock(sub: AccessSub): number | null {
  if (!sub || sub.status !== "past_due" || !sub.current_period_end) return null;
  const graceEnd = new Date(sub.current_period_end);
  graceEnd.setDate(graceEnd.getDate() + (sub.grace_period_days ?? 7));
  const diff = graceEnd.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function effectiveStatus(sub: AccessSub): SubscriptionStatus {
  if (!sub) return "canceled";
  if (sub.status === "past_due" && !hasAccess(sub)) return "locked";
  return sub.status as SubscriptionStatus;
}
