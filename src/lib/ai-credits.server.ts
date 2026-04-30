import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Plan } from "@/services/planService";

export type AICreditsState = {
  monthlyAllowance: number;
  usedThisPeriod: number;
  monthlyRemaining: number;
  topupBalance: number;
  totalAvailable: number;
  planName: string;
  planSlug: string;
};

export async function getAICreditsState(clientId: string): Promise<AICreditsState | null> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, plan_id, ai_credits_used_this_period, ai_credits_topup_balance")
    .eq("client_id", clientId)
    .in("status", ["trialing", "active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub) return null;

  let plan: Plan | null = null;
  const pid = (sub as { plan_id?: string }).plan_id;
  if (pid) {
    const { data: prow } = await supabaseAdmin.from("plans").select("*").eq("id", pid).maybeSingle();
    plan = (prow as Plan) ?? null;
  }
  const monthlyAllowance = plan?.monthly_ai_credits ?? 0;
  const used = (sub as { ai_credits_used_this_period?: number }).ai_credits_used_this_period ?? 0;
  const topup = (sub as { ai_credits_topup_balance?: number }).ai_credits_topup_balance ?? 0;
  const monthlyRemaining = Math.max(0, monthlyAllowance - used);

  return {
    monthlyAllowance,
    usedThisPeriod: used,
    monthlyRemaining,
    topupBalance: topup,
    totalAvailable: monthlyRemaining + topup,
    planName: plan?.name ?? "Plan",
    planSlug: plan?.slug ?? "unknown",
  };
}

/** Returns false if not enough credits. Side effect: debits subscription on success. */
export async function consumeAICredits(clientId: string, credits: number): Promise<boolean> {
  if (credits <= 0) return true;
  const { data, error } = await supabaseAdmin.rpc("consume_ai_credits", {
    p_client_id: clientId,
    p_credits: credits,
  });
  if (error) {
    console.error("[consumeAICredits]", error);
    return false;
  }
  return data === true;
}

export function aiQuotaErrorPayload(state: AICreditsState) {
  return {
    error: "Insufficient AI credits",
    code: "ai_credits_exceeded",
    monthlyAllowance: state.monthlyAllowance,
    usedThisPeriod: state.usedThisPeriod,
    topupBalance: state.topupBalance,
    totalAvailable: state.totalAvailable,
  };
}
