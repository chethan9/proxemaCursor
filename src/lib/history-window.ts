import { supabaseAdmin } from "@/integrations/supabase/admin";

export async function getEffectiveHistoryFrom(storeId: string): Promise<string | null> {
  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("orders_history_from, client_id")
    .eq("id", storeId)
    .maybeSingle();

  const siteFrom = (store as { orders_history_from?: string | null } | null)?.orders_history_from || null;
  const clientId = (store as { client_id?: string | null } | null)?.client_id || null;
  if (!clientId) return siteFrom;

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_id, status")
    .eq("client_id", clientId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const planId = (sub as { plan_id?: string | null } | null)?.plan_id || null;
  if (!planId) return siteFrom;

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("max_initial_history_days")
    .eq("id", planId)
    .maybeSingle();

  const days = (plan as { max_initial_history_days?: number | null } | null)?.max_initial_history_days;
  if (days == null) return siteFrom;

  const planFloor = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const siteFromDate = siteFrom ? new Date(siteFrom) : new Date(0);
  const effective = planFloor > siteFromDate ? planFloor : siteFromDate;
  return effective.toISOString();
}

export async function getPlanHistoryDaysForClient(clientId: string | null): Promise<number | null> {
  if (!clientId) return null;
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan_id")
    .eq("client_id", clientId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const planId = (sub as { plan_id?: string | null } | null)?.plan_id || null;
  if (!planId) return null;
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("max_initial_history_days")
    .eq("id", planId)
    .maybeSingle();
  return (plan as { max_initial_history_days?: number | null } | null)?.max_initial_history_days ?? null;
}