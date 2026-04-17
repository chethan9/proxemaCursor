import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/integrations/supabase/client";

function getEntityType(topic: string): string | null {
  const prefix = topic.split(".")[0];
  const map: Record<string, string> = {
    product: "product",
    order: "order",
    customer: "customer",
    coupon: "coupon",
  };
  return map[prefix] || null;
}

function getChangeType(topic: string): string {
  const action = topic.split(".")[1];
  if (action === "created") return "created";
  if (action === "deleted") return "deleted";
  return "updated";
}

function extractEntityName(entityType: string, payload: Record<string, unknown>): string {
  if (entityType === "product") return (payload.name as string) || "";
  if (entityType === "order") return `#${payload.number || payload.id || ""}`;
  if (entityType === "customer") {
    const first = (payload.first_name as string) || "";
    const last = (payload.last_name as string) || "";
    return `${first} ${last}`.trim() || (payload.email as string) || "";
  }
  if (entityType === "coupon") return (payload.code as string) || "";
  return "";
}

const TRACKED_FIELDS: Record<string, string[]> = {
  product: ["name", "status", "price", "regular_price", "sale_price", "stock_quantity", "stock_status", "manage_stock", "sku", "weight", "description", "short_description", "catalog_visibility"],
  order: ["status", "total", "currency", "payment_method", "payment_method_title", "billing", "shipping", "line_items", "date_paid", "date_completed"],
  customer: ["first_name", "last_name", "email", "role", "billing", "shipping"],
  coupon: ["code", "amount", "discount_type", "usage_count", "usage_limit", "date_expires"],
};

function computeDiff(
  entityType: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown>
): { field: string; old: unknown; new: unknown }[] {
  const fields = TRACKED_FIELDS[entityType] || Object.keys(after);
  const diffs: { field: string; old: unknown; new: unknown }[] = [];

  for (const field of fields) {
    const oldVal = before ? before[field] : undefined;
    const newVal = after[field];
    const oldStr = JSON.stringify(oldVal ?? null);
    const newStr = JSON.stringify(newVal ?? null);
    if (oldStr !== newStr) {
      diffs.push({ field, old: oldVal ?? null, new: newVal ?? null });
    }
  }
  return diffs;
}

function getTableForEntity(entityType: string): string | null {
  const map: Record<string, string> = {
    product: "products",
    order: "orders",
    customer: "customers",
    coupon: "coupons",
  };
  return map[entityType] || null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId } = req.query;
  if (!storeId || typeof storeId !== "string") {
    return res.status(400).json({ error: "Store ID required" });
  }

  try {
    const topic = (req.headers["x-wc-webhook-topic"] as string) || "unknown";
    const deliveryId = req.headers["x-wc-webhook-delivery-id"] as string;

    const { data: store } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .single();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    // Store the webhook event
    const { data: event, error: eventError } = await supabase
      .from("webhook_events")
      .insert({
        store_id: storeId,
        topic,
        payload: req.body || {},
        processing_status: "pending",
      })
      .select()
      .single();

    if (eventError || !event) {
      console.error("Error storing webhook event:", eventError);
      return res.status(500).json({ error: "Failed to store event" });
    }

    // Update webhook last_triggered_at
    if (topic !== "unknown") {
      await supabase
        .from("webhooks")
        .update({
          last_triggered_at: new Date().toISOString(),
          status: "active",
          failure_count: 0,
        })
        .eq("store_id", storeId)
        .eq("topic", topic);
    }

    // Track entity changes
    const entityType = getEntityType(topic);
    const payload = (req.body || {}) as Record<string, unknown>;
    const wooId = payload.id as number | undefined;

    if (entityType && wooId) {
      const changeType = getChangeType(topic);
      const entityName = extractEntityName(entityType, payload);
      const tableName = getTableForEntity(entityType);

      let snapshotBefore: Record<string, unknown> | null = null;

      // Fetch previous state for updated entities
      if (changeType === "updated" && tableName) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase as any)
          .from(tableName)
          .select("woo_data")
          .eq("store_id", storeId)
          .eq("woo_id", wooId)
          .maybeSingle();

        if (existing?.woo_data) {
          snapshotBefore = existing.woo_data as Record<string, unknown>;
        }
      }

      const changedFields = changeType === "deleted"
        ? [{ field: "status", old: "exists", new: "deleted" }]
        : computeDiff(entityType, snapshotBefore, payload);

      // Determine specific change type
      let finalChangeType = changeType;
      if (changeType === "updated" && entityType === "order") {
        const statusChanged = changedFields.find(f => f.field === "status");
        if (statusChanged) finalChangeType = "status_change";
      }
      if (changeType === "updated" && entityType === "product") {
        const stockChanged = changedFields.find(f => f.field === "stock_quantity" || f.field === "stock_status");
        if (stockChanged && changedFields.length <= 2) finalChangeType = "stock_change";
      }

      if (changedFields.length > 0 || changeType === "created") {
        await supabase.from("entity_changes").insert({
          store_id: storeId,
          entity_type: entityType,
          entity_id: String(wooId),
          woo_id: wooId,
          entity_name: entityName,
          change_type: finalChangeType,
          changed_fields: changedFields,
          snapshot_before: snapshotBefore,
          snapshot_after: payload,
          source: "webhook",
        });
      }
    }

    // Mark event completed
    await supabase
      .from("webhook_events")
      .update({
        processing_status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", event.id);

    return res.status(200).json({
      success: true,
      event_id: event.id,
      message: "Webhook received and processed",
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};