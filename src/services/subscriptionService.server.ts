import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Subscription = Tables<"subscriptions">;

export async function createTrialSubscription(
  clientId: string,
  planId: string,
  trialDays: number,
  currency: string
): Promise<Subscription> {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);
  const insert: TablesInsert<"subscriptions"> = {
    client_id: clientId,
    plan_id: planId,
    status: "trialing",
    trial_end: trialEnd.toISOString(),
    current_period_start: new Date().toISOString(),
    current_period_end: trialEnd.toISOString(),
    currency,
  };
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .insert(insert)
    .select()
    .single();
  if (error) throw error;
  await insertSubscriptionEvent(data.id, "trial_started", null, "trialing");
  return data;
}

export async function insertSubscriptionEvent(
  subscriptionId: string,
  eventType: string,
  fromStatus: string | null,
  toStatus: string | null,
  metadata?: Record<string, unknown>
): Promise<void> {
  await supabaseAdmin.from("subscription_events").insert({
    subscription_id: subscriptionId,
    event_type: eventType,
    from_status: fromStatus as never,
    to_status: toStatus as never,
    metadata: (metadata as never) ?? null,
  });
}