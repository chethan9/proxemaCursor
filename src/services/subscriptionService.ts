import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Subscription = Tables<"subscriptions">;
export type SubscriptionEvent = Tables<"subscription_events">;

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