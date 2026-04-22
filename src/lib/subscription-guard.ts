import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { hasAccess, effectiveStatus } from "./subscription-state";

export interface GuardResult {
  allowed: boolean;
  subscriptionStatus: string;
  lockedReason?: string;
}

export async function checkClientSubscription(clientId: string): Promise<GuardResult> {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_end, grace_period_days")
    .eq("client_id", clientId)
    .neq("status", "canceled")
    .maybeSingle();
  if (error) {
    return { allowed: false, subscriptionStatus: "error", lockedReason: error.message };
  }
  if (!data) {
    return { allowed: false, subscriptionStatus: "none", lockedReason: "No active subscription" };
  }
  const effective = effectiveStatus(data);
  const allowed = hasAccess(data);
  return {
    allowed,
    subscriptionStatus: effective,
    lockedReason: allowed
      ? undefined
      : effective === "locked"
      ? "Subscription locked due to non-payment"
      : "Subscription inactive",
  };
}

export async function requireActiveSubscription(
  _req: NextApiRequest,
  res: NextApiResponse,
  clientId: string
): Promise<boolean> {
  const result = await checkClientSubscription(clientId);
  if (result.allowed) return true;
  res.status(402).json({
    error: "Subscription required",
    subscriptionStatus: result.subscriptionStatus,
    reason: result.lockedReason,
    upgradeUrl: "/pricing",
  });
  return false;
}
