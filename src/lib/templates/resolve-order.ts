import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveOrderData(supabase: SupabaseClient, storeId: string, orderId: string): Promise<ResolvedData> {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (orderErr) throw orderErr;
  if (!order) throw new Error("Order not found");

  const { data: store } = await supabase
    .from("stores")
    .select("id, name, url, logo_url, currency, support_email, phone, address")
    .eq("id", storeId)
    .maybeSingle();

  const items = Array.isArray(order.line_items) ? order.line_items : [];
  const billing = (order.billing_address as Record<string, unknown>) || {};
  const shipping = (order.shipping_address as Record<string, unknown>) || {};

  const currency = (order.currency as string) || (store?.currency as string) || "USD";
  const dateStr = order.created_at ? new Date(order.created_at as string).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";

  return {
    store: {
      name: (store?.name as string) || "Store",
      email: (store?.support_email as string) || "",
      phone: (store?.phone as string) || "",
      address: (store?.address as string) || "",
      logo: (store?.logo_url as string) || "",
      website: (store?.url as string) || "",
    },
    order: {
      number: (order.number as string) || String(order.woo_id || ""),
      date: dateStr,
      status: (order.status as string) || "",
      currency,
      items: items.map((it: Record<string, unknown>) => ({
        sku: (it.sku as string) || "",
        name: (it.name as string) || "",
        quantity: Number(it.quantity || 0),
        price: fmt(it.price),
        total: fmt(it.total),
        image: (it.image as { src?: string } | undefined)?.src || "",
      })),
      subtotal: fmt(items.reduce((s: number, it: Record<string, unknown>) => s + Number(it.subtotal || it.total || 0), 0)),
      shipping_total: fmt(order.shipping_total),
      tax_total: fmt(order.total_tax),
      discount_total: fmt(order.discount_total),
      total: fmt(order.total),
    },
    customer: {
      first_name: (billing.first_name as string) || "",
      last_name: (billing.last_name as string) || "",
      email: (order.billing_email as string) || (billing.email as string) || "",
      phone: (billing.phone as string) || "",
    },
    billing: {
      first_name: (billing.first_name as string) || "",
      last_name: (billing.last_name as string) || "",
      address_1: (billing.address_1 as string) || "",
      address_2: (billing.address_2 as string) || "",
      city: (billing.city as string) || "",
      state: (billing.state as string) || "",
      postcode: (billing.postcode as string) || "",
      country: (billing.country as string) || "",
    },
    shipping: {
      first_name: (shipping.first_name as string) || (billing.first_name as string) || "",
      last_name: (shipping.last_name as string) || (billing.last_name as string) || "",
      address_1: (shipping.address_1 as string) || (billing.address_1 as string) || "",
      address_2: (shipping.address_2 as string) || (billing.address_2 as string) || "",
      city: (shipping.city as string) || (billing.city as string) || "",
      state: (shipping.state as string) || (billing.state as string) || "",
      postcode: (shipping.postcode as string) || (billing.postcode as string) || "",
      country: (shipping.country as string) || (billing.country as string) || "",
    },
    payment: {
      method: (order.payment_method_title as string) || (order.payment_method as string) || "",
      transaction_id: (order.transaction_id as string) || "",
    },
  };
}

export interface ResolvedData {
  store: { name: string; email: string; phone: string; address: string; logo: string; website: string };
  order: { number: string; date: string; status: string; currency: string; subtotal: string; shipping_total: string; tax_total: string; discount_total: string; total: string; items: Array<{ sku: string; name: string; quantity: number; price: string; total: string; image: string }> };
  customer: { first_name: string; last_name: string; email: string; phone: string };
  billing: { first_name: string; last_name: string; address_1: string; address_2: string; city: string; state: string; postcode: string; country: string };
  shipping: { first_name: string; last_name: string; address_1: string; address_2: string; city: string; state: string; postcode: string; country: string };
  payment: { method: string; transaction_id: string };
}

function fmt(n: unknown): string {
  return Number(n || 0).toFixed(2);
}