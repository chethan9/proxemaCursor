import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import { refreshCustomerForOrder } from "@/lib/customer-refresh";
import { normalizeWooDate } from "@/lib/woo-date";

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

function toJson(obj: unknown) {
  return JSON.parse(JSON.stringify(obj ?? null));
}

function buildProductRow(storeId: string, p: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    store_id: storeId,
    woo_id: p.id as number,
    name: (p.name as string) || "",
    slug: (p.slug as string) || null,
    sku: (p.sku as string) || null,
    price: p.price ? parseFloat(p.price as string) : null,
    regular_price: p.regular_price ? parseFloat(p.regular_price as string) : null,
    sale_price: p.sale_price ? parseFloat(p.sale_price as string) : null,
    stock_quantity: (p.stock_quantity as number) ?? null,
    stock_status: (p.stock_status as string) || null,
    status: (p.status as string) || null,
    type: (p.type as string) || null,
    description: (p.description as string) || null,
    short_description: (p.short_description as string) || null,
    categories: toJson(p.categories),
    images: toJson(p.images),
    attributes: toJson(p.attributes || []),
    brands: toJson(p.brands || []),
    raw_data: toJson(p),
    synced_at: now,
  };
}

function buildOrderRow(storeId: string, o: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    store_id: storeId,
    woo_id: o.id as number,
    order_number: (o.number as string) || null,
    status: (o.status as string) || null,
    currency: (o.currency as string) || null,
    total: o.total ? parseFloat(o.total as string) : null,
    discount_total: o.discount_total ? parseFloat(o.discount_total as string) : null,
    shipping_total: o.shipping_total ? parseFloat(o.shipping_total as string) : null,
    customer_id: (o.customer_id as number) || null,
    payment_method: (o.payment_method as string) || null,
    payment_method_title: (o.payment_method_title as string) || null,
    billing: toJson(o.billing),
    shipping: toJson(o.shipping),
    line_items: toJson(o.line_items),
    shipping_lines: toJson(o.shipping_lines || []),
    fee_lines: toJson(o.fee_lines || []),
    coupon_lines: toJson(o.coupon_lines || []),
    raw_data: toJson(o),
    date_created: normalizeWooDate(o.date_created, o.date_created_gmt),
    date_modified: normalizeWooDate(o.date_modified, o.date_modified_gmt),
    synced_at: now,
  };
}

function buildCustomerRow(storeId: string, c: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    store_id: storeId,
    woo_id: c.id as number,
    email: (c.email as string) || null,
    first_name: (c.first_name as string) || null,
    last_name: (c.last_name as string) || null,
    username: (c.username as string) || null,
    role: (c.role as string) || null,
    billing: toJson(c.billing),
    shipping: toJson(c.shipping),
    avatar_url: (c.avatar_url as string) || null,
    is_paying_customer: (c.is_paying_customer as boolean) || false,
    orders_count: (c.orders_count as number) || 0,
    total_spent: c.total_spent ? parseFloat(c.total_spent as string) : null,
    raw_data: toJson(c),
    date_created: (c.date_created as string) || null,
    synced_at: now,
  };
}

function buildCouponRow(storeId: string, c: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    store_id: storeId,
    woo_id: c.id as number,
    code: (c.code as string) || "",
    amount: c.amount ? parseFloat(c.amount as string) : null,
    discount_type: (c.discount_type as string) || null,
    description: (c.description as string) || "",
    date_expires: (c.date_expires as string) || null,
    usage_count: (c.usage_count as number) || 0,
    individual_use: (c.individual_use as boolean) || false,
    product_ids: toJson(c.product_ids || []),
    excluded_product_ids: toJson(c.excluded_product_ids || []),
    usage_limit: (c.usage_limit as number) || null,
    usage_limit_per_user: (c.usage_limit_per_user as number) || null,
    free_shipping: (c.free_shipping as boolean) || false,
    minimum_amount: c.minimum_amount ? parseFloat(c.minimum_amount as string) : null,
    maximum_amount: c.maximum_amount ? parseFloat(c.maximum_amount as string) : null,
    raw_data: toJson(c),
    date_created: (c.date_created as string) || null,
    synced_at: now,
  };
}

async function upsertEntityFromWebhook(
  storeId: string,
  entityType: string,
  changeType: string,
  payload: Record<string, unknown>
) {
  const tableName = getTableForEntity(entityType);
  if (!tableName || !payload.id) return;

  if (changeType === "deleted") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from(tableName)
      .select("*")
      .eq("store_id", storeId)
      .eq("woo_id", payload.id as number)
      .maybeSingle();

    await supabase.from("deleted_records").insert({
      store_id: storeId,
      entity_type: entityType,
      entity_id: String(payload.id),
      woo_id: payload.id as number,
      entity_name: extractEntityName(entityType, existing?.raw_data || payload),
      snapshot: existing?.raw_data || payload,
      source: "webhook",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from(tableName)
      .delete()
      .eq("store_id", storeId)
      .eq("woo_id", payload.id as number);
    return;
  }

  let row: Record<string, unknown> | null = null;
  if (entityType === "product") row = buildProductRow(storeId, payload);
  else if (entityType === "order") row = buildOrderRow(storeId, payload);
  else if (entityType === "customer") row = buildCustomerRow(storeId, payload);
  else if (entityType === "coupon") row = buildCouponRow(storeId, payload);

  if (!row) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from(tableName)
    .upsert(row, { onConflict: "store_id,woo_id", ignoreDuplicates: false });

  if (error) {
    console.error(`[Webhook] Upsert error on ${tableName}:`, error.message);
  }
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
    const headers = req.headers;
    let topic = (headers["x-wc-webhook-topic"] as string) || "";

    if (!topic) {
      const resource = (headers["x-wc-webhook-resource"] as string) || "";
      const event = (headers["x-wc-webhook-event"] as string) || "";
      if (resource && event) topic = `${resource}.${event}`;
    }

    if (!topic) {
      const payload = (req.body || {}) as Record<string, unknown>;
      const keys = Object.keys(payload);
      let resource = "";
      if ("line_items" in payload || "billing" in payload) resource = "order";
      else if ("sku" in payload || "regular_price" in payload) resource = "product";
      else if ("email" in payload && ("first_name" in payload || "username" in payload)) resource = "customer";
      else if ("code" in payload && "discount_type" in payload) resource = "coupon";

      if (resource) {
        const action = (payload.date_modified && payload.date_created && payload.date_modified !== payload.date_created) ? "updated" : "created";
        topic = `${resource}.${action}`;
      }
      if (!topic) topic = keys.length === 0 ? "ping" : "unknown";
    }

    const { data: store } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .single();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

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

    const entityType = getEntityType(topic);
    const payload = (req.body || {}) as Record<string, unknown>;
    const wooId = payload.id as number | undefined;

    if (entityType && wooId) {
      const changeType = getChangeType(topic);
      const entityName = extractEntityName(entityType, payload);
      const tableName = getTableForEntity(entityType);

      let snapshotBefore: Record<string, unknown> | null = null;

      if (changeType === "updated" && tableName) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase as any)
          .from(tableName)
          .select("raw_data")
          .eq("store_id", storeId)
          .eq("woo_id", wooId)
          .maybeSingle();

        if (existing?.raw_data) {
          snapshotBefore = existing.raw_data as Record<string, unknown>;
        }
      }

      const changedFields = changeType === "deleted"
        ? [{ field: "status", old: "exists", new: "deleted" }]
        : computeDiff(entityType, snapshotBefore, payload);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("entity_changes").insert({
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

      // Actually upsert/delete the entity in the mirrored table
      try {
        await upsertEntityFromWebhook(storeId, entityType, changeType, payload);
      } catch (upsertErr) {
        console.error(`[Webhook] Entity upsert failed for ${entityType}:`, upsertErr);
      }

      // For order webhooks: ensure customer record exists in our mirror so the
      // order doesn't display as "Guest" once Woo has assigned a customer_id.
      if (entityType === "order" && changeType !== "deleted") {
        const wooCustomerId = (payload.customer_id as number) || 0;
        if (wooCustomerId > 0) {
          refreshCustomerForOrder(storeId, wooCustomerId).catch((e) => {
            console.warn("[Webhook] refreshCustomerForOrder failed:", e);
          });
        }
      }
    }

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