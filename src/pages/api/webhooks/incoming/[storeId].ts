import type { IncomingHttpHeaders } from "http";
import crypto from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import type { Json } from "@/integrations/supabase/database.types";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import { scheduleDashboardSummaryRefresh } from "@/lib/dashboard-summary.server";
import { refreshCustomerForOrder } from "@/lib/customer-refresh";
import { normalizeWooDate } from "@/lib/woo-date";

/** WooCommerce sends custom headers; Node lowercases keys. Values may be string[]. */
function firstHeader(headers: IncomingHttpHeaders, key: string): string {
  const v = headers[key.toLowerCase()];
  if (Array.isArray(v)) return (v[0] ?? "").trim();
  return typeof v === "string" ? v.trim() : "";
}

/** Normalize JSON body, URL-encoded ping (`webhook_id=123`), or raw string. */
function normalizePayload(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  if (typeof body === "string") {
    const s = body.trim();
    if (!s) return {};
    try {
      const j = JSON.parse(s) as unknown;
      if (j && typeof j === "object" && !Array.isArray(j)) return j as Record<string, unknown>;
    } catch {
      /* fall through */
    }
    if (/webhook_id=/i.test(s)) {
      const q = new URLSearchParams(s);
      const id = q.get("webhook_id");
      if (id != null && id !== "") return { webhook_id: id };
    }
    return {};
  }
  return {};
}

const WOO_TOPIC_PATTERN = /^[a-z][a-z0-9_]*\.[a-z0-9_.]+$/i;

function inferTopicFromPayloadShape(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload);
  let resource = "";
  if ("line_items" in payload || "billing" in payload) resource = "order";
  else if ("sku" in payload || "regular_price" in payload) resource = "product";
  else if ("email" in payload && ("first_name" in payload || "username" in payload)) resource = "customer";
  else if ("code" in payload && "discount_type" in payload) resource = "coupon";

  if (resource) {
    const action =
      payload.date_modified && payload.date_created && payload.date_modified !== payload.date_created
        ? "updated"
        : "created";
    return `${resource}.${action}`;
  }
  if (keys.length === 0) return "ping";
  return "";
}

function isPingOnlyPayload(payload: Record<string, unknown>): boolean {
  const keys = Object.keys(payload);
  return keys.length === 1 && keys[0] === "webhook_id";
}

async function resolveTopicForStore(storeId: string, headers: IncomingHttpHeaders, rawBody: unknown): Promise<string> {
  const payload = normalizePayload(rawBody);

  const headerTopic = firstHeader(headers, "x-wc-webhook-topic");
  if (headerTopic) return headerTopic;

  const resH = firstHeader(headers, "x-wc-webhook-resource");
  const evtH = firstHeader(headers, "x-wc-webhook-event");
  if (resH && evtH) return `${resH}.${evtH}`;

  const pt = payload.topic;
  if (typeof pt === "string" && WOO_TOPIC_PATTERN.test(pt)) return pt;

  const resP = payload.resource;
  const evtP = payload.event;
  if (typeof resP === "string" && typeof evtP === "string") return `${resP}.${evtP}`;

  const inferred = inferTopicFromPayloadShape(payload);
  if (inferred && inferred !== "") return inferred;

  /** WooCommerce `deliver_ping()` POSTs `webhook_id=N` with no topic headers (verification ping). */
  const widRaw = payload.webhook_id;
  if (widRaw !== undefined && widRaw !== null) {
    const wid = typeof widRaw === "number" ? widRaw : parseInt(String(widRaw), 10);
    if (Number.isFinite(wid) && wid > 0) {
      const { data: row } = await supabase
        .from("webhooks")
        .select("topic")
        .eq("store_id", storeId)
        .eq("woo_webhook_id", wid)
        .maybeSingle();
      if (row?.topic) return row.topic;
    }
  }

  if (isPingOnlyPayload(payload)) return "ping";
  if (Object.keys(payload).length === 0) return "ping";
  return "unknown";
}

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

function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer | string) => {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifyWooWebhookSignature(raw: Buffer, secret: string, signatureHeader: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("base64");
  const a = Buffer.from(signatureHeader.trim(), "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseBodyForWebhook(rawBuf: Buffer): unknown {
  const txt = rawBuf.toString("utf8");
  if (!txt.trim()) return {};
  try {
    return JSON.parse(txt) as unknown;
  } catch {
    return txt;
  }
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

  let rawBuf: Buffer;
  try {
    rawBuf = await readRawBody(req);
  } catch (e) {
    console.error("[Webhook] read body:", e);
    return res.status(400).json({ error: "Invalid body" });
  }

  const sigHeader = firstHeader(req.headers, "x-wc-webhook-signature");
  if (!sigHeader) {
    console.warn("[Webhook] missing X-WC-Webhook-Signature", { storeId });
    return res.status(401).json({ error: "Missing signature" });
  }

  const parsedOnce = parseBodyForWebhook(rawBuf);
  const payloadProbe = normalizePayload(parsedOnce);

  const headerWid = firstHeader(req.headers, "x-wc-webhook-id");
  let wooWebhookNumeric = headerWid ? parseInt(headerWid, 10) : NaN;
  if (!Number.isFinite(wooWebhookNumeric)) {
    const w = payloadProbe.webhook_id;
    if (w != null) {
      wooWebhookNumeric = typeof w === "number" ? w : parseInt(String(w), 10);
    }
  }
  if (!Number.isFinite(wooWebhookNumeric) || wooWebhookNumeric <= 0) {
    console.warn("[Webhook] could not resolve Woo webhook id", { storeId });
    return res.status(401).json({ error: "Invalid webhook id" });
  }

  const { data: whRow } = await supabase
    .from("webhooks")
    .select("secret")
    .eq("store_id", storeId)
    .eq("woo_webhook_id", wooWebhookNumeric)
    .maybeSingle();

  if (!whRow?.secret) {
    return res.status(401).json({ error: "Webhook secret not found" });
  }

  if (!verifyWooWebhookSignature(rawBuf, whRow.secret, sigHeader)) {
    console.warn("[Webhook] signature mismatch", { storeId, wooWebhookNumeric });
    return res.status(401).json({ error: "Invalid signature" });
  }

  try {
    const topic = await resolveTopicForStore(storeId, req.headers, parsedOnce);

    const { data: store } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .single();

    if (!store) {
      return res.status(404).json({ error: "Store not found" });
    }

    const payloadForStore = normalizePayload(parsedOnce);

    const { data: event, error: eventError } = await supabase
      .from("webhook_events")
      .insert({
        store_id: storeId,
        topic,
        payload: toJson(payloadForStore) as Json,
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
    const payload = payloadForStore;
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
        if (entityType === "order" || entityType === "product") {
          scheduleDashboardSummaryRefresh(storeId);
        }
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
    bodyParser: false,
  },
};