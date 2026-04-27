import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import type { Json } from "@/integrations/supabase/database.types";

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
  date_completed?: string | null;
}

function toJson<T>(v: T): Json {
  return JSON.parse(JSON.stringify(v)) as Json;
}

/**
 * Re-fetch order from Woo and upsert into the mirror.
 * Used when an order transitions to a state that may add server-computed
 * fields (e.g. date_completed) beyond what the PUT response returned.
 * Never throws — failures are logged and swallowed.
 */
export async function refreshOrderFromWoo(
  storeId: string,
  wooOrderId: number,
): Promise<{ refreshed: boolean; reason?: string }> {
  try {
    const creds = await getStoreCreds(storeId);
    if (!creds) return { refreshed: false, reason: "no_creds" };

    const o = await wooRequest<WooOrder>(creds, "GET", `orders/${wooOrderId}`);

    const update = {
      order_number: o.number,
      status: o.status,
      currency: o.currency,
      total: o.total ? parseFloat(o.total) : null,
      subtotal: o.subtotal ? parseFloat(o.subtotal) : null,
      total_tax: o.total_tax ? parseFloat(o.total_tax) : null,
      discount_total: o.discount_total ? parseFloat(o.discount_total) : null,
      shipping_total: o.shipping_total ? parseFloat(o.shipping_total) : null,
      customer_id: o.customer_id ?? null,
      payment_method: o.payment_method,
      payment_method_title: o.payment_method_title,
      billing: toJson(o.billing),
      shipping: toJson(o.shipping),
      line_items: toJson(o.line_items),
      shipping_lines: toJson(o.shipping_lines || []),
      fee_lines: toJson(o.fee_lines || []),
      coupon_lines: toJson(o.coupon_lines || []),
      raw_data: toJson(o),
      synced_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("orders")
      .update(update)
      .eq("store_id", storeId)
      .eq("woo_id", wooOrderId);

    if (error) {
      console.warn("[refreshOrderFromWoo] update failed:", error.message);
      return { refreshed: false, reason: "update_error" };
    }
    return { refreshed: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn(`[refreshOrderFromWoo] storeId=${storeId} wooId=${wooOrderId}: ${msg}`);
    return { refreshed: false, reason: "fetch_error" };
  }
}