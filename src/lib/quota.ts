import { supabase } from "@/integrations/supabase/client";
import type { Plan } from "@/services/planService";

export interface QuotaSnapshot {
  max_sites: number;
  max_products_per_site: number;
  max_users: number;
  max_api_calls_per_month: number;
  features: Record<string, boolean>;
  planSlug: string;
  planName: string;
}

export interface UsageSnapshot {
  sites: number;
  products: number;
  users: number;
  apiCallsThisMonth: number;
}

export async function getClientPlan(clientId: string): Promise<Plan | null> {
  const { data: sub } = await supabase
    .from("subscriptions" as never)
    .select("plan_id")
    .eq("client_id", clientId)
    .in("status", ["trialing", "active", "past_due"])
    .maybeSingle();

  let planId: string | null = null;
  if (sub && typeof sub === "object" && "plan_id" in sub) {
    planId = (sub as { plan_id: string }).plan_id;
  }

  if (!planId) {
    const { data } = await supabase.from("plans").select("*").eq("slug", "starter").maybeSingle();
    return (data as Plan) || null;
  }

  const { data } = await supabase.from("plans").select("*").eq("id", planId).maybeSingle();
  return (data as Plan) || null;
}

export async function getClientQuota(clientId: string): Promise<QuotaSnapshot | null> {
  const plan = await getClientPlan(clientId);
  if (!plan) return null;
  return {
    max_sites: plan.max_sites,
    max_products_per_site: plan.max_products_per_site,
    max_users: plan.max_users,
    max_api_calls_per_month: plan.max_api_calls_per_month,
    features: (plan.features as Record<string, boolean>) || {},
    planSlug: plan.slug,
    planName: plan.name,
  };
}

export async function getCurrentUsage(clientId: string): Promise<UsageSnapshot> {
  const [sites, products, users] = await Promise.all([
    supabase.from("stores").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    supabase.from("products").select("id, stores!inner(client_id)", { count: "exact", head: true }).eq("stores.client_id", clientId),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("client_id", clientId),
  ]);
  return {
    sites: sites.count || 0,
    products: products.count || 0,
    users: users.count || 0,
    apiCallsThisMonth: 0,
  };
}

export async function canAddSite(clientId: string): Promise<{ ok: boolean; limit: number; current: number; planName: string }> {
  const quota = await getClientQuota(clientId);
  const usage = await getCurrentUsage(clientId);
  if (!quota) return { ok: true, limit: 0, current: usage.sites, planName: "" };
  return {
    ok: usage.sites < quota.max_sites,
    limit: quota.max_sites,
    current: usage.sites,
    planName: quota.planName,
  };
}

export async function canAddProduct(clientId: string): Promise<{ ok: boolean; limit: number; current: number; planName: string }> {
  const quota = await getClientQuota(clientId);
  const usage = await getCurrentUsage(clientId);
  if (!quota) return { ok: true, limit: 0, current: usage.products, planName: "" };
  return {
    ok: usage.products < quota.max_products_per_site,
    limit: quota.max_products_per_site,
    current: usage.products,
    planName: quota.planName,
  };
}