import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Json } from "@/integrations/supabase/database.types";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import { logActivity } from "@/lib/activity-log";
import { refreshCustomerForOrder } from "@/lib/customer-refresh";
import { refreshOrderFromWoo } from "@/lib/order-refresh";

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

interface WooOrder {
  id: number;
  number: string;
  status: string;
  currency: string;
  total: string;
  subtotal: string;
  total_tax: string;
  discount_total: string;
  shipping_total: string;
  customer_id: number;
  payment_method: string;
  payment_method_title: string;
  billing: Record<string, unknown>;
  shipping: Record<string, unknown>;
  line_items: unknown[];
  shipping_lines: unknown[];
  fee_lines: unknown[];
  coupon_lines: unknown[];
  date_created: string;
  date_modified: string;
}

function diffFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: { field: string; old: unknown; new: unknown }[] = [];
  keys.forEach((k) => {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changes.push({ field: k, old: before[k], new: after[k] });
    }
  });
  return changes;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId, orderId } = req.query;
  if (typeof storeId !== "string" || typeof orderId !== "string") {
    return res.status(400).json({ error: "storeId and orderId required" });
  }

  const { data: localOrder } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .single();

  if (!localOrder?.woo_id) {
    return res.status(404).json({ error: "Order not found" });
  }

  const { status } = req.body || {};
  const wooPayload: Record<string, unknown> = {};
  if (status !== undefined) wooPayload.status = status;

  const beforeSnapshot = toJson(localOrder);
  const entityName = `#${localOrder.order_number || localOrder.woo_id}`;

  try {
    const store = await getStoreCreds(storeId);
    if (!store) throw new Error("Store not connected");

    const updated = await wooRequest<WooOrder>(
      store,
      "PUT",
      `orders/${localOrder.woo_id}`,
      wooPayload
    );

    const now = new Date().toISOString();
    const updatePayload = {
      order_number: updated.number,
      status: updated.status,
      currency: updated.currency,
      total: updated.total ? parseFloat(updated.total) : null,
      subtotal: updated.subtotal ? parseFloat(updated.subtotal) : null,
      total_tax: updated.total_tax ? parseFloat(updated.total_tax) : null,
      discount_total: updated.discount_total ? parseFloat(updated.discount_total) : null,
      shipping_total: updated.shipping_total ? parseFloat(updated.shipping_total) : null,
      payment_method: updated.payment_method,
      payment_method_title: updated.payment_method_title,
      billing: toJson(updated.billing),
      shipping: toJson(updated.shipping),
      line_items: toJson(updated.line_items),
      shipping_lines: toJson(updated.shipping_lines || []),
      fee_lines: toJson(updated.fee_lines || []),
      coupon_lines: toJson(updated.coupon_lines || []),
      raw_data: toJson(updated),
      date_modified: updated.date_modified,
      synced_at: now,
    };

    const { data: saved, error: saveErr } = await supabaseAdmin
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId)
      .select("*")
      .single();
    if (saveErr) throw saveErr;

    const afterSnapshot = toJson(saved);
    const changeType = localOrder.status !== updated.status ? "status_change" : "updated";
    const changedFields = diffFields(
      localOrder as Record<string, unknown>,
      saved as Record<string, unknown>
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("entity_changes").insert({
      store_id: storeId,
      entity_type: "order",
      entity_id: orderId,
      woo_id: localOrder.woo_id,
      entity_name: entityName,
      change_type: changeType,
      changed_fields: changedFields as unknown as Json,
      snapshot_before: beforeSnapshot,
      snapshot_after: afterSnapshot,
      source: "dashboard",
      status: "success",
    });

    void logActivity({
      action: localOrder.status !== updated.status ? "order.status_change" : "order.update",
      entityType: "order",
      entityId: orderId,
      before: localOrder as Record<string, unknown>,
      after: saved as Record<string, unknown>,
      metadata: { woo_id: localOrder.woo_id, store_id: storeId },
      req,
    });

    if (
      updated.status === "completed" &&
      localOrder.status !== "completed" &&
      typeof updated.customer_id === "number" &&
      updated.customer_id > 0
    ) {
      void refreshCustomerForOrder(storeId, updated.customer_id);
    }

    if (updated.status === "completed" && localOrder.status !== "completed") {
      void refreshOrderFromWoo(storeId, localOrder.woo_id);
    }

    return res.status(200).json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[order update] error:", err);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("entity_changes").insert({
      store_id: storeId,
      entity_type: "order",
      entity_id: orderId,
      woo_id: localOrder.woo_id,
      entity_name: entityName,
      change_type: "update_failed",
      changed_fields: null,
      snapshot_before: beforeSnapshot,
      snapshot_after: null,
      source: "dashboard",
      status: "failed",
      error_message: message,
      retry_payload: toJson(wooPayload),
    });

    return res.status(500).json({
      error: "Failed to update order",
      message,
    });
  }
}