import type { SupabaseClient } from "@supabase/supabase-js";

export interface OrderContext {
  order: {
    id: string;
    number: string;
    date: string;
    date_iso: string;
    status: string;
    currency: string;
    currency_symbol: string;
    total: number;
    subtotal: number;
    shipping_total: number;
    tax_total: number;
    discount_total: number;
    payment_method: string;
    payment_method_title: string;
    transaction_id: string;
    customer_note: string;
  };
  customer: {
    id: string | number;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    phone: string;
  };
  billing: AddressContext;
  shipping: AddressContext;
  items: Array<{
    name: string;
    sku: string;
    qty: number;
    price: number;
    subtotal: number;
    total: number;
    tax: number;
    image: string;
    product_id: number | null;
    variation_id: number | null;
    meta: Array<{ key: string; value: string }>;
  }>;
  store: {
    name: string;
    url: string;
    logo_url: string;
    currency: string;
    address: string;
    email: string;
    phone: string;
  };
  meta: {
    printed_at: string;
    template_name: string;
    template_type: string;
  };
}

export interface AddressContext {
  first_name: string;
  last_name: string;
  full_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
  email: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹", AED: "د.إ", SAR: "﷼", KWD: "د.ك", JPY: "¥", CNY: "¥",
};

function emptyAddress(): AddressContext {
  return { first_name: "", last_name: "", full_name: "", company: "", address_1: "", address_2: "", city: "", state: "", postcode: "", country: "", phone: "", email: "" };
}

function toAddress(a: Record<string, unknown> | null | undefined): AddressContext {
  if (!a) return emptyAddress();
  const first = String(a.first_name || "");
  const last = String(a.last_name || "");
  return {
    first_name: first,
    last_name: last,
    full_name: [first, last].filter(Boolean).join(" "),
    company: String(a.company || ""),
    address_1: String(a.address_1 || ""),
    address_2: String(a.address_2 || ""),
    city: String(a.city || ""),
    state: String(a.state || ""),
    postcode: String(a.postcode || ""),
    country: String(a.country || ""),
    phone: String(a.phone || ""),
    email: String(a.email || ""),
  };
}

export async function resolveOrderContext(
  supabase: SupabaseClient,
  storeId: string,
  orderId: string,
  templateMeta: { name: string; type: string }
): Promise<OrderContext> {
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", orderId).eq("store_id", storeId).maybeSingle();
  if (error) throw error;
  if (!order) throw new Error("Order not found");

  const { data: store } = await supabase.from("stores").select("name, url, logo_url, currency, address, support_email, phone").eq("id", storeId).maybeSingle();

  const billingRaw = (order.billing_address as Record<string, unknown>) || {};
  const shippingRaw = (order.shipping_address as Record<string, unknown>) || {};
  const itemsRaw = Array.isArray(order.line_items) ? (order.line_items as Record<string, unknown>[]) : [];
  const currency = String(order.currency || store?.currency || "USD");

  const billing = toAddress(billingRaw);
  const shipping = toAddress(Object.keys(shippingRaw).length ? shippingRaw : billingRaw);

  const customerEmail = String(order.billing_email || billingRaw.email || "");
  const customerPhone = String(billingRaw.phone || "");

  return {
    order: {
      id: String(order.id),
      number: String(order.number || order.woo_id || order.id),
      date: order.created_at ? new Date(order.created_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
      date_iso: order.created_at ? new Date(order.created_at as string).toISOString() : "",
      status: String(order.status || ""),
      currency,
      currency_symbol: CURRENCY_SYMBOLS[currency] || currency,
      total: Number(order.total || 0),
      subtotal: itemsRaw.reduce((s, it) => s + Number(it.subtotal || it.total || 0), 0),
      shipping_total: Number(order.shipping_total || 0),
      tax_total: Number(order.total_tax || 0),
      discount_total: Number(order.discount_total || 0),
      payment_method: String(order.payment_method || ""),
      payment_method_title: String(order.payment_method_title || order.payment_method || ""),
      transaction_id: String(order.transaction_id || ""),
      customer_note: String(order.customer_note || ""),
    },
    customer: {
      id: order.customer_id || "",
      first_name: billing.first_name,
      last_name: billing.last_name,
      full_name: billing.full_name,
      email: customerEmail,
      phone: customerPhone,
    },
    billing,
    shipping,
    items: itemsRaw.map((it) => ({
      name: String(it.name || ""),
      sku: String(it.sku || ""),
      qty: Number(it.quantity || 0),
      price: Number(it.price || 0),
      subtotal: Number(it.subtotal || it.total || 0),
      total: Number(it.total || 0),
      tax: Number(it.total_tax || 0),
      image: ((it.image as { src?: string } | undefined)?.src) || "",
      product_id: it.product_id ? Number(it.product_id) : null,
      variation_id: it.variation_id ? Number(it.variation_id) : null,
      meta: Array.isArray(it.meta_data) ? (it.meta_data as Array<{ key: string; value: unknown }>).map((m) => ({ key: String(m.key || ""), value: String(m.value ?? "") })) : [],
    })),
    store: {
      name: String(store?.name || "Store"),
      url: String(store?.url || ""),
      logo_url: String(store?.logo_url || ""),
      currency,
      address: String(store?.address || ""),
      email: String(store?.support_email || ""),
      phone: String(store?.phone || ""),
    },
    meta: {
      printed_at: new Date().toLocaleString("en-US"),
      template_name: templateMeta.name,
      template_type: templateMeta.type,
    },
  };
}

export function getSampleContext(templateMeta: { name: string; type: string }): OrderContext {
  return {
    order: { id: "sample-1", number: "1024", date: "May 22, 2024", date_iso: "2024-05-22T10:30:00Z", status: "processing", currency: "USD", currency_symbol: "$", total: 88.80, subtotal: 78.00, shipping_total: 8.00, tax_total: 7.80, discount_total: 5.00, payment_method: "stripe", payment_method_title: "Credit Card (Stripe)", transaction_id: "ch_3OqXyZ2eZvKYlo2C1abc", customer_note: "Please leave at the front door." },
    customer: { id: 42, first_name: "Sarah", last_name: "Johnson", full_name: "Sarah Johnson", email: "sarah@example.com", phone: "+1 555 0123" },
    billing: { first_name: "Sarah", last_name: "Johnson", full_name: "Sarah Johnson", company: "Acme Corp", address_1: "742 Evergreen Terrace", address_2: "Suite 4B", city: "Springfield", state: "IL", postcode: "62704", country: "United States", phone: "+1 555 0123", email: "sarah@example.com" },
    shipping: { first_name: "Sarah", last_name: "Johnson", full_name: "Sarah Johnson", company: "", address_1: "742 Evergreen Terrace", address_2: "Suite 4B", city: "Springfield", state: "IL", postcode: "62704", country: "United States", phone: "", email: "" },
    items: [
      { name: "Premium Wool Blanket", sku: "BLK-001-NVY", qty: 2, price: 29.00, subtotal: 58.00, total: 58.00, tax: 5.80, image: "", product_id: 101, variation_id: null, meta: [{ key: "Color", value: "Navy" }, { key: "Size", value: "Queen" }] },
      { name: "Espresso Roast Coffee", sku: "COF-002", qty: 1, price: 20.00, subtotal: 20.00, total: 20.00, tax: 2.00, image: "", product_id: 102, variation_id: null, meta: [] },
    ],
    store: { name: "Sample Store", url: "https://sample.store", logo_url: "", currency: "USD", address: "100 Main Street, Springfield, IL", email: "support@sample.store", phone: "+1 555 0100" },
    meta: { printed_at: new Date().toLocaleString("en-US"), template_name: templateMeta.name, template_type: templateMeta.type },
  };
}