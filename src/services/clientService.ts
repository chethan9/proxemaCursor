import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/helpers";

export type Client = Tables<"clients">;
export type ClientInsert = TablesInsert<"clients">;
export type ClientUpdate = TablesUpdate<"clients">;
export type Plan = Tables<"plans">;
export type Subscription = Tables<"subscriptions">;

export interface ClientWithStats extends Client {
  stores_count?: number;
  api_keys_count?: number;
  calls_30d?: number;
}

export const getClients = fetchClients;
export const getClient = getClientById;

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getClientById(id: string): Promise<Client | null> {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateClient(id: string, updates: ClientUpdate): Promise<Client> {
  const { data, error } = await supabase.from("clients").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export interface CreateClientResult {
  client: Client;
  subscription: Subscription | null;
  trialStarted: boolean;
  noPlanAvailable: boolean;
}

async function findDefaultTrialPlan(): Promise<Plan | null> {
  const { data: def } = await supabase
    .from("plans")
    .select("*")
    .eq("is_default_trial", true)
    .eq("is_active", true)
    .maybeSingle();
  if (def) return def as Plan;

  const { data: candidates } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .eq("is_custom", false);

  if (!candidates || candidates.length === 0) return null;

  const ranked = (candidates as Plan[])
    .map((p) => {
      const prices = (p.prices as Record<string, number>) || {};
      const usd = typeof prices.USD === "number" ? prices.USD : Number.POSITIVE_INFINITY;
      return { plan: p, usd };
    })
    .filter((x) => Number.isFinite(x.usd))
    .sort((a, b) => a.usd - b.usd);

  return ranked[0]?.plan ?? null;
}

async function createTrialSubscription(clientId: string, plan: Plan): Promise<Subscription> {
  const trialDays = plan.trial_days ?? 14;
  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + trialDays);

  const prices = (plan.prices as Record<string, number>) || {};
  const currency = prices.USD != null ? "USD" : Object.keys(prices)[0] || "USD";

  const insert: TablesInsert<"subscriptions"> = {
    client_id: clientId,
    plan_id: plan.id,
    status: "trialing",
    trial_end: trialEnd.toISOString(),
    current_period_start: now.toISOString(),
    current_period_end: trialEnd.toISOString(),
    currency,
    grace_period_days: 7,
    renewal_mode: "manual",
  };

  const { data, error } = await supabase
    .from("subscriptions")
    .insert(insert)
    .select()
    .single();
  if (error) throw error;

  await supabase.from("subscription_events").insert({
    subscription_id: data.id,
    event_type: "trial_started",
    from_status: null,
    to_status: "trialing",
    metadata: { plan_slug: plan.slug, trial_days: trialDays } as never,
  });

  return data as Subscription;
}

export async function createClient(input: ClientInsert): Promise<CreateClientResult> {
  const { data: client, error } = await supabase
    .from("clients")
    .insert(input)
    .select()
    .single();
  if (error) throw error;

  const { data: auth } = await supabase.auth.getUser();
  const actorId = auth.user?.id ?? null;

  await supabase.from("activity_log").insert({
    actor_user_id: actorId,
    action: "client.created",
    entity_type: "client",
    entity_id: client.id,
    client_id: client.id,
    metadata: { name: client.name } as never,
  });

  const { data: settings } = await supabase
    .from("app_settings")
    .select("billing_enforcement_enabled, billing_dev_mode")
    .eq("id", "global")
    .maybeSingle();
  const enforcementEnabled = settings?.billing_enforcement_enabled ?? true;
  const devMode = settings?.billing_dev_mode ?? false;
  const enforcementApplies = enforcementEnabled && !devMode;

  if (enforcementApplies) {
    // Mandatory plan selection: client starts with no subscription; user picks plan from /pricing.
    return { client, subscription: null, trialStarted: false, noPlanAvailable: false };
  }

  // Enforcement disabled: auto-start a trial so admins/operators can use the app freely.
  const plan = await findDefaultTrialPlan();
  if (!plan) {
    return { client, subscription: null, trialStarted: false, noPlanAvailable: true };
  }

  try {
    const subscription = await createTrialSubscription(client.id, plan);
    await supabase.from("activity_log").insert({
      actor_user_id: actorId,
      action: "subscription.trial_started",
      entity_type: "subscription",
      entity_id: subscription.id,
      client_id: client.id,
      metadata: { plan_slug: plan.slug, plan_id: plan.id, trial_days: plan.trial_days ?? 14 } as never,
    });
    return { client, subscription, trialStarted: true, noPlanAvailable: false };
  } catch (subErr) {
    console.warn("[createClient] auto-trial failed", subErr);
    return { client, subscription: null, trialStarted: false, noPlanAvailable: false };
  }
}