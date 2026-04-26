import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Plan } from "@/services/planService";
import type { QuotaCheck } from "@/lib/quota";

async function getClientPlanServer(clientId: string): Promise<Plan | null> {
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_id")
    .eq("client_id", clientId)
    .in("status", ["trialing", "active", "past_due"])
    .maybeSingle();

  const planId = (sub as { plan_id?: string } | null)?.plan_id ?? null;
  if (!planId) {
    const { data } = await supabaseAdmin.from("plans").select("*").eq("slug", "starter").maybeSingle();
    return (data as Plan) || null;
  }
  const { data } = await supabaseAdmin.from("plans").select("*").eq("id", planId).maybeSingle();
  return (data as Plan) || null;
}

export async function canAddSiteServer(clientId: string): Promise<QuotaCheck> {
  const plan = await getClientPlanServer(clientId);
  if (!plan) return { ok: true, limit: 999999, current: 0, planName: "", planSlug: "" };
  const { count } = await supabaseAdmin.from("stores").select("id", { count: "exact", head: true }).eq("client_id", clientId);
  const current = count || 0;
  return {
    ok: current < plan.max_sites,
    limit: plan.max_sites,
    current,
    planName: plan.name,
    planSlug: plan.slug,
  };
}

export async function canAddProductServer(clientId: string, storeId: string): Promise<QuotaCheck> {
  const plan = await getClientPlanServer(clientId);
  if (!plan) return { ok: true, limit: 999999, current: 0, planName: "", planSlug: "" };
  const { count } = await supabaseAdmin.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId);
  const current = count || 0;
  return {
    ok: current < plan.max_products_per_site,
    limit: plan.max_products_per_site,
    current,
    planName: plan.name,
    planSlug: plan.slug,
  };
}