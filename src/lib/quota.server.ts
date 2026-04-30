import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Plan } from "@/services/planService";
import type { QuotaCheck } from "@/lib/quota";
import { getAppSettings } from "@/lib/app-settings.server";
import { isBillingEffectivelyEnforced } from "@/lib/billing-mode";

const DAY_MS = 86400_000;

interface ClientPlanContext {
  plan: Plan | null;
  subscriptionId: string | null;
  graceUntil: string | null;
}

async function getClientPlanContext(clientId: string): Promise<ClientPlanContext> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, plan_id, quota_grace_until")
    .eq("client_id", clientId)
    .in("status", ["trialing", "active", "past_due"])
    .maybeSingle();

  const subRow = sub as { id?: string; plan_id?: string; quota_grace_until?: string | null } | null;
  const planId = subRow?.plan_id ?? null;
  let plan: Plan | null = null;
  if (!planId) {
    const { data } = await supabaseAdmin.from("plans").select("*").eq("slug", "starter").maybeSingle();
    plan = (data as Plan) || null;
  } else {
    const { data } = await supabaseAdmin.from("plans").select("*").eq("id", planId).maybeSingle();
    plan = (data as Plan) || null;
  }
  return {
    plan,
    subscriptionId: subRow?.id ?? null,
    graceUntil: subRow?.quota_grace_until ?? null,
  };
}

/**
 * Apply soft-grace policy when usage exceeds the plan limit.
 *
 * Rules:
 *   - Enforcement disabled globally → always permissive.
 *   - First exceed → set quota_grace_until = now + grace_days; allow.
 *   - Within grace window → allow (with warning).
 *   - Past grace window → block.
 *   - Back under limit → clear grace timestamp.
 */
async function applyGracePolicy(
  clientId: string,
  ctx: ClientPlanContext,
  current: number,
  limit: number,
  planName: string,
  planSlug: string
): Promise<QuotaCheck> {
  const settings = await getAppSettings();
  if (!isBillingEffectivelyEnforced(settings)) {
    return { ok: true, limit, current, planName, planSlug };
  }

  const overLimit = current >= limit;

  if (!overLimit) {
    if (ctx.subscriptionId && ctx.graceUntil) {
      await supabaseAdmin
        .from("subscriptions")
        .update({ quota_grace_until: null })
        .eq("id", ctx.subscriptionId);
    }
    return { ok: true, limit, current, planName, planSlug };
  }

  if (!ctx.subscriptionId) {
    return { ok: false, limit, current, planName, planSlug };
  }

  const now = Date.now();
  const graceDays = settings.quotaGraceDays;

  if (!ctx.graceUntil) {
    const until = new Date(now + graceDays * DAY_MS).toISOString();
    await supabaseAdmin
      .from("subscriptions")
      .update({ quota_grace_until: until })
      .eq("id", ctx.subscriptionId);
    return { ok: true, limit, current, planName, planSlug, graceUntil: until };
  }

  const graceEnd = new Date(ctx.graceUntil).getTime();
  if (Number.isFinite(graceEnd) && graceEnd > now) {
    return { ok: true, limit, current, planName, planSlug, graceUntil: ctx.graceUntil };
  }

  return { ok: false, limit, current, planName, planSlug, graceUntil: ctx.graceUntil };
}

export async function canAddSiteServer(clientId: string): Promise<QuotaCheck> {
  const ctx = await getClientPlanContext(clientId);
  if (!ctx.plan) return { ok: true, limit: 999999, current: 0, planName: "", planSlug: "" };
  const { count } = await supabaseAdmin.from("stores").select("id", { count: "exact", head: true }).eq("client_id", clientId);
  const current = count || 0;
  return applyGracePolicy(clientId, ctx, current, ctx.plan.max_sites, ctx.plan.name, ctx.plan.slug);
}

export async function canAddProductServer(clientId: string, storeId: string): Promise<QuotaCheck> {
  const ctx = await getClientPlanContext(clientId);
  if (!ctx.plan) return { ok: true, limit: 999999, current: 0, planName: "", planSlug: "" };
  const { count } = await supabaseAdmin.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId);
  const current = count || 0;
  return applyGracePolicy(clientId, ctx, current, ctx.plan.max_products_per_site, ctx.plan.name, ctx.plan.slug);
}
