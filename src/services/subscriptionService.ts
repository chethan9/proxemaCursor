import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/helpers";
import type { SubscriptionStatus } from "@/lib/subscription-state";

export type Subscription = Tables<"subscriptions">;
export type SubscriptionEvent = Tables<"subscription_events">;

export interface AdminSubscription extends Subscription {
  client?: { id: string; name: string } | null;
  plan?: { id: string; name: string; slug: string } | null;
}

export async function getSubscriptionByClient(clientId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("client_id", clientId)
    .neq("status", "canceled")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSubscriptionEvents(
  subscriptionId: string,
  limit = 20
): Promise<SubscriptionEvent[]> {
  const { data, error } = await supabase
    .from("subscription_events")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function listAllSubscriptions(): Promise<AdminSubscription[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, client:clients(id, name), plan:plans(id, name, slug)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as AdminSubscription[]) || [];
}

export async function listClientsWithoutActiveSubscription(): Promise<Array<{ id: string; name: string }>> {
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("client_id")
    .neq("status", "canceled");
  const subbed = new Set((subs || []).map((s) => s.client_id));
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name")
    .order("name");
  if (error) throw error;
  return (clients || []).filter((c) => !subbed.has(c.id));
}

async function logSubscriptionActivity(params: {
  subscriptionId: string;
  clientId: string | null;
  action: string;
  diff?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  await supabase.from("activity_log").insert({
    actor_user_id: user?.id ?? null,
    actor_email: user?.email ?? null,
    actor_type: "admin",
    action: params.action,
    entity_type: "subscription",
    entity_id: params.subscriptionId,
    client_id: params.clientId,
    diff: (params.diff ?? null) as never,
    metadata: { ...(params.metadata ?? {}), module: "billing" } as never,
  });
  await supabase.from("subscription_events").insert({
    subscription_id: params.subscriptionId,
    event_type: params.action,
    metadata: (params.metadata ?? null) as never,
  });
}

export interface AssignSubscriptionInput {
  clientId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gracePeriodDays: number;
}

export async function assignSubscription(input: AssignSubscriptionInput): Promise<Subscription> {
  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      client_id: input.clientId,
      plan_id: input.planId,
      status: input.status,
      current_period_start: input.currentPeriodStart,
      current_period_end: input.currentPeriodEnd,
      grace_period_days: input.gracePeriodDays,
    })
    .select()
    .single();
  if (error) throw error;
  await logSubscriptionActivity({
    subscriptionId: data.id,
    clientId: input.clientId,
    action: "subscription.assigned",
    metadata: { plan_id: input.planId, status: input.status },
  });
  return data as Subscription;
}

export type AdminUpdates = Partial<
  Pick<
    Subscription,
    "plan_id" | "status" | "current_period_start" | "current_period_end" | "grace_period_days"
  >
>;

export async function updateSubscriptionAdmin(id: string, updates: AdminUpdates): Promise<Subscription> {
  const { data: before } = await supabase.from("subscriptions").select("*").eq("id", id).single();
  const { data, error } = await supabase
    .from("subscriptions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  const diff: Record<string, { old: unknown; new: unknown }> = {};
  for (const k of Object.keys(updates)) {
    const oldV = (before as Record<string, unknown> | null)?.[k];
    const newV = (data as unknown as Record<string, unknown>)[k];
    if (oldV !== newV) diff[k] = { old: oldV, new: newV };
  }
  await logSubscriptionActivity({
    subscriptionId: id,
    clientId: (data as Subscription).client_id,
    action: "subscription.updated",
    diff,
  });
  return data as Subscription;
}

export async function extendTrial(id: string, days: number): Promise<Subscription> {
  const { data: sub } = await supabase.from("subscriptions").select("*").eq("id", id).single();
  if (!sub) throw new Error("Subscription not found");
  const base = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
  base.setDate(base.getDate() + days);
  return updateSubscriptionAdmin(id, {
    status: "trialing",
    current_period_end: base.toISOString(),
  });
}

export async function cancelSubscriptionAdmin(id: string, reason?: string): Promise<Subscription> {
  const { data: before } = await supabase.from("subscriptions").select("*").eq("id", id).single();
  const { data, error } = await supabase
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  await logSubscriptionActivity({
    subscriptionId: id,
    clientId: (data as Subscription).client_id,
    action: "subscription.canceled",
    metadata: { reason: reason ?? null },
    diff: { status: { old: (before as Subscription | null)?.status, new: "canceled" } },
  });
  return data as Subscription;
}

export async function reactivateSubscription(id: string): Promise<Subscription> {
  return updateSubscriptionAdmin(id, { status: "active" });
}

export async function switchPlan(id: string, newPlanId: string): Promise<Subscription> {
  return updateSubscriptionAdmin(id, { plan_id: newPlanId });
}