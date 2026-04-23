import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, Database } from "@/integrations/supabase/helpers";
import { getWebhookDeliveryUrl } from "@/lib/app-url";

export type Webhook = Tables<"webhooks">;
export type WebhookEventRow = Tables<"webhook_events">;
export type WebhookInsert = TablesInsert<"webhooks">;

// Topics we want to register for each store
export const WEBHOOK_TOPICS = [
  { topic: "product.created", name: "Product Created" },
  { topic: "product.updated", name: "Product Updated" },
  { topic: "product.deleted", name: "Product Deleted" },
  { topic: "order.created", name: "Order Created" },
  { topic: "order.updated", name: "Order Updated" },
  { topic: "order.deleted", name: "Order Deleted" },
  { topic: "customer.created", name: "Customer Created" },
  { topic: "customer.updated", name: "Customer Updated" },
  { topic: "customer.deleted", name: "Customer Deleted" },
  { topic: "coupon.created", name: "Coupon Created" },
  { topic: "coupon.updated", name: "Coupon Updated" },
  { topic: "coupon.deleted", name: "Coupon Deleted" },
] as const;

export async function getWebhooksByStore(storeId: string): Promise<Webhook[]> {
  const { data, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("store_id", storeId)
    .order("topic", { ascending: true });

  if (error) {
    console.error("Error fetching webhooks:", error);
    throw error;
  }
  return data || [];
}

export async function createWebhook(webhook: WebhookInsert): Promise<Webhook> {
  const { data, error } = await supabase
    .from("webhooks")
    .insert(webhook)
    .select()
    .single();

  if (error) {
    console.error("Error creating webhook:", error);
    throw error;
  }
  return data;
}

export async function updateWebhook(
  id: string,
  updates: Partial<Webhook>
): Promise<Webhook> {
  const { data, error } = await supabase
    .from("webhooks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating webhook:", error);
    throw error;
  }
  return data;
}

export async function deleteWebhook(id: string): Promise<void> {
  const { error } = await supabase.from("webhooks").delete().eq("id", id);

  if (error) {
    console.error("Error deleting webhook:", error);
    throw error;
  }
}

export async function getWebhookEventsByStore(
  storeId: string,
  limit = 50
): Promise<WebhookEventRow[]> {
  const { data, error } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching webhook events:", error);
    throw error;
  }
  return data || [];
}

export async function createWebhookEvent(event: {
  store_id: string;
  topic: string;
  payload: Record<string, unknown>;
}): Promise<WebhookEventRow> {
  const { data, error } = await supabase
    .from("webhook_events")
    .insert({
      store_id: event.store_id,
      topic: event.topic,
      payload: event.payload as unknown as Database["public"]["Tables"]["webhook_events"]["Insert"]["payload"],
      processing_status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating webhook event:", error);
    throw error;
  }
  return data;
}

export async function updateWebhookEventStatus(
  id: string,
  status: "processing" | "completed" | "failed",
  errorMessage?: string
): Promise<void> {
  const updates: Partial<Tables<"webhook_events">> = {
    processing_status: status,
    processed_at: status === "completed" ? new Date().toISOString() : null,
  };
  
  if (errorMessage) {
    updates.error_message = errorMessage;
  }

  const { error } = await supabase
    .from("webhook_events")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Error updating webhook event:", error);
    throw error;
  }
}

// Generate a random secret for webhook verification
export function generateWebhookSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let secret = "";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

// Build the delivery URL for a store's webhooks
export function buildWebhookDeliveryUrl(storeId: string): string {
  return getWebhookDeliveryUrl(storeId);
}

// Register all webhooks for a store (creates records, actual WooCommerce registration done via API)
export async function registerWebhooksForStore(storeId: string): Promise<Webhook[]> {
  const deliveryUrl = buildWebhookDeliveryUrl(storeId);
  const webhooks: Webhook[] = [];

  for (const { topic } of WEBHOOK_TOPICS) {
    try {
      // Check if webhook already exists
      const { data: existing } = await supabase
        .from("webhooks")
        .select("*")
        .eq("store_id", storeId)
        .eq("topic", topic)
        .single();

      if (existing) {
        webhooks.push(existing);
        continue;
      }

      // Create new webhook record
      const webhook = await createWebhook({
        store_id: storeId,
        topic,
        delivery_url: deliveryUrl,
        secret: generateWebhookSecret(),
        status: "pending",
      });
      webhooks.push(webhook);
    } catch (error) {
      console.error(`Error registering webhook ${topic}:`, error);
    }
  }

  return webhooks;
}

// Get webhook stats for a store
export async function getWebhookStats(storeId: string): Promise<{
  total: number;
  active: number;
  failed: number;
  eventsToday: number;
}> {
  const [webhooksRes, eventsRes] = await Promise.all([
    supabase.from("webhooks").select("status").eq("store_id", storeId),
    supabase
      .from("webhook_events")
      .select("id")
      .eq("store_id", storeId)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const webhooks = webhooksRes.data || [];
  const events = eventsRes.data || [];

  return {
    total: webhooks.length,
    active: webhooks.filter((w) => w.status === "active").length,
    failed: webhooks.filter((w) => w.status === "failed").length,
    eventsToday: events.length,
  };
}