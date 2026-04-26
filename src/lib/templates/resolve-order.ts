import type { SupabaseClient } from "@supabase/supabase-js";

export interface AddressNested {
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string;
  zip: string;
}

export interface PartyContext {
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  address: { line1: string; line2: string };
  city: string;
  state: string;
  country: string;
  zip: string;
}

export interface OrderContext {
  store: {
    name: string;
    logo: string;
    logo_url: string;
    email: string;
    phone: string;
    website: string;
    url: string;
    currency: string;
    address: AddressNested;
  };
  order: {
    id: string;
    number: string;
    date: string;
    date_iso: string;
    status: string;
    currency: string;
    currency_symbol: string;
    notes: string;
    customer_note: string;
    transaction_id: string;
    payment_method: string;
    payment_method_title: string;
    total: number;
    subtotal: number;
    tax_total: number;
    shipping_total: number;
    discount_total: number;
  };
  billing: PartyContext;
  shipping: PartyContext;
  customer: {
    id: string | number;
    name: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  payment: {
    method: string;
    title: string;
    status: string;
    transaction_id: string;
  };
  shipping_method: {
    name: string;
    tracking_number: string;
  };
  totals: {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
  };
  meta: {
    note: string;
    gift_message: string;
    delivery_date: string;
    custom_field_1: string;
    custom_field_2: string;
    printed_at: string;
    template_name: string;
    template_type: string;
  };
  settings: {
    show_logo: boolean;
    show_sku: boolean;
    show_images: boolean;
    currency_symbol: string;
  };
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    qty: number;
    price: number;
    subtotal: number;
    total: number;
    tax: number;
    image: string;
    product_id: number | null;
    variation_id: number | null;
    variation: Record<string, string> & { text: string };
    variation_text: string;
    meta: Array<{ key: string; value: string }>;
  }>;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹", AED: "د.إ", SAR: "﷼", KWD: "د.ك", JPY: "¥", CNY: "¥", BHD: "د.ب", OMR: "ر.ع.", QAR: "ر.ق",
};

function asAddress(a: Record<string, unknown> | null | undefined): PartyContext {
  const x = (a || {}) as Record<string, unknown>;
  const first = String(x.first_name || "");
  const last = String(x.last_name || "");
  return {
    name: [first, last].filter(Boolean).join(" "),
    first_name: first,
    last_name: last,
    email: String(x.email || ""),
    phone: String(x.phone || ""),
    company: String(x.company || ""),
    address: { line1: String(x.address_1 || ""), line2: String(x.address_2 || "") },
    city: String(x.city || ""),
    state: String(x.state || ""),
    country: String(x.country || ""),
    zip: String(x.postcode || ""),
  };
}

function asStoreAddress(a: Record<string, unknown> | null | undefined): AddressNested {
  const x = (a || {}) as Record<string, unknown>;
  return {
    line1: String(x.line1 || x.address_1 || ""),
    line2: String(x.line2 || x.address_2 || ""),
    city: String(x.city || ""),
    state: String(x.state || ""),
    country: String(x.country || ""),
    zip: String(x.zip || x.postcode || ""),
  };
}

function buildVariation(meta: Array<{ key: string; value: string }>): Record<string, string> & { text: string } {
  const obj: Record<string, string> = {};
  for (const m of meta) {
    if (!m.key) continue;
    const k = m.key.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    obj[k] = m.value;
  }
  const text = meta.filter((m) => m.key).map((m) => `${m.key}: ${m.value}`).join(", ");
  return Object.assign(obj, { text }) as Record<string, string> & { text: string };
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

  const { data: store } = await supabase
    .from("stores")
    .select("name, url, logo_url, currency, support_email, phone, website, address")
    .eq("id", storeId)
    .maybeSingle();

  const billingRaw = (order.billing as Record<string, unknown>) || {};
  const shippingRaw = (order.shipping as Record<string, unknown>) || {};
  const itemsRaw = Array.isArray(order.line_items) ? (order.line_items as Record<string, unknown>[]) : [];
  const shippingLines = Array.isArray(order.shipping_lines) ? (order.shipping_lines as Record<string, unknown>[]) : [];
  const rawData = (order.raw_data as Record<string, unknown>) || {};
  const metaData = Array.isArray(rawData.meta_data) ? (rawData.meta_data as Array<{ key: string; value: unknown }>) : [];

  const currency = String(order.currency || store?.currency || "USD");
  const billing = asAddress(billingRaw);
  const shipping = asAddress(Object.keys(shippingRaw).length ? shippingRaw : billingRaw);

  const subtotal = itemsRaw.reduce((s, it) => s + Number(it.subtotal || it.total || 0), 0);
  const shipMethod = shippingLines[0] || {};
  const shipMeta = Array.isArray(shipMethod.meta_data) ? (shipMethod.meta_data as Array<{ key: string; value: unknown }>) : [];
  const tracking = String(shipMeta.find((m) => /tracking/i.test(String(m.key)))?.value || "");

  const metaLookup = (key: RegExp): string => String(metaData.find((m) => key.test(String(m.key || "")))?.value ?? "");

  const storeAddress = asStoreAddress(store?.address as Record<string, unknown> | null);

  return {
    store: {
      name: String(store?.name || "Store"),
      logo: String(store?.logo_url || ""),
      logo_url: String(store?.logo_url || ""),
      email: String(store?.support_email || ""),
      phone: String(store?.phone || ""),
      website: String(store?.website || store?.url || ""),
      url: String(store?.url || ""),
      currency,
      address: storeAddress,
    },
    order: {
      id: String(order.id),
      number: String(order.order_number || order.woo_id || order.id),
      date: order.date_created ? new Date(order.date_created as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
      date_iso: order.date_created ? new Date(order.date_created as string).toISOString() : "",
      status: String(order.status || ""),
      currency,
      currency_symbol: CURRENCY_SYMBOLS[currency] || currency,
      notes: String(rawData.customer_note || ""),
      customer_note: String(rawData.customer_note || ""),
      transaction_id: String(rawData.transaction_id || ""),
      payment_method: String(order.payment_method || ""),
      payment_method_title: String(order.payment_method_title || order.payment_method || ""),
      total: Number(order.total || 0),
      subtotal,
      tax_total: Number(order.total_tax || 0),
      shipping_total: Number(order.shipping_total || 0),
      discount_total: Number(order.discount_total || 0),
    },
    billing,
    shipping,
    customer: {
      id: order.customer_id || "",
      name: billing.name,
      first_name: billing.first_name,
      last_name: billing.last_name,
      email: billing.email,
      phone: billing.phone,
    },
    payment: {
      method: String(order.payment_method || ""),
      title: String(order.payment_method_title || ""),
      status: String(order.status || ""),
      transaction_id: String(rawData.transaction_id || ""),
    },
    shipping_method: {
      name: String(shipMethod.method_title || ""),
      tracking_number: tracking,
    },
    totals: {
      subtotal,
      discount: Number(order.discount_total || 0),
      shipping: Number(order.shipping_total || 0),
      tax: Number(order.total_tax || 0),
      total: Number(order.total || 0),
    },
    meta: {
      note: String(rawData.customer_note || ""),
      gift_message: metaLookup(/gift[_\s]?message/i),
      delivery_date: metaLookup(/delivery[_\s]?date/i),
      custom_field_1: metaLookup(/custom[_\s]?field[_\s]?1/i),
      custom_field_2: metaLookup(/custom[_\s]?field[_\s]?2/i),
      printed_at: new Date().toLocaleString("en-US"),
      template_name: templateMeta.name,
      template_type: templateMeta.type,
    },
    settings: {
      show_logo: true,
      show_sku: true,
      show_images: true,
      currency_symbol: CURRENCY_SYMBOLS[currency] || currency,
    },
    items: itemsRaw.map((it) => {
      const meta = Array.isArray(it.meta_data) ? (it.meta_data as Array<{ key: string; value: unknown }>).map((m) => ({ key: String(m.key || ""), value: String(m.value ?? "") })) : [];
      const variation = buildVariation(meta);
      return {
        name: String(it.name || ""),
        sku: String(it.sku || ""),
        quantity: Number(it.quantity || 0),
        qty: Number(it.quantity || 0),
        price: Number(it.price || 0),
        subtotal: Number(it.subtotal || it.total || 0),
        total: Number(it.total || 0),
        tax: Number(it.total_tax || 0),
        image: ((it.image as { src?: string } | undefined)?.src) || "",
        product_id: it.product_id ? Number(it.product_id) : null,
        variation_id: it.variation_id ? Number(it.variation_id) : null,
        variation,
        variation_text: variation.text,
        meta,
      };
    }),
  };
}

export function getSampleContext(templateMeta: { name: string; type: string }): OrderContext {
  const billing: PartyContext = {
    name: "Sarah Johnson", first_name: "Sarah", last_name: "Johnson", email: "sarah@example.com", phone: "+1 555 0123", company: "Acme Corp",
    address: { line1: "742 Evergreen Terrace", line2: "Suite 4B" }, city: "Springfield", state: "IL", country: "United States", zip: "62704",
  };
  const shipping: PartyContext = { ...billing, company: "" };
  return {
    store: {
      name: "Sample Store", logo: "", logo_url: "", email: "support@sample.store", phone: "+1 555 0100", website: "https://sample.store", url: "https://sample.store",
      currency: "USD",
      address: { line1: "100 Main Street", line2: "", city: "Springfield", state: "IL", country: "United States", zip: "62704" },
    },
    order: {
      id: "sample-1", number: "1024", date: "May 22, 2024", date_iso: "2024-05-22T10:30:00Z", status: "processing",
      currency: "USD", currency_symbol: "$", notes: "Please leave at the front door.", customer_note: "Please leave at the front door.",
      transaction_id: "ch_3OqXyZ2eZvKYlo2C1abc", payment_method: "stripe", payment_method_title: "Credit Card (Stripe)",
      total: 88.80, subtotal: 78.00, tax_total: 7.80, shipping_total: 8.00, discount_total: 5.00,
    },
    billing,
    shipping,
    customer: { id: 42, name: "Sarah Johnson", first_name: "Sarah", last_name: "Johnson", email: "sarah@example.com", phone: "+1 555 0123" },
    payment: { method: "stripe", title: "Credit Card (Stripe)", status: "processing", transaction_id: "ch_3OqXyZ2eZvKYlo2C1abc" },
    shipping_method: { name: "Standard Shipping", tracking_number: "1Z999AA10123456784" },
    totals: { subtotal: 78.00, discount: 5.00, shipping: 8.00, tax: 7.80, total: 88.80 },
    meta: {
      note: "Please leave at the front door.", gift_message: "Happy birthday!", delivery_date: "May 25, 2024", custom_field_1: "", custom_field_2: "",
      printed_at: new Date().toLocaleString("en-US"), template_name: templateMeta.name, template_type: templateMeta.type,
    },
    settings: { show_logo: true, show_sku: true, show_images: true, currency_symbol: "$" },
    items: [
      {
        name: "Premium Wool Blanket", sku: "BLK-001-NVY", quantity: 2, qty: 2, price: 29.00, subtotal: 58.00, total: 58.00, tax: 5.80,
        image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200", product_id: 101, variation_id: 201,
        variation: Object.assign({ size: "Queen", color: "Navy" }, { text: "Size: Queen, Color: Navy" }) as Record<string, string> & { text: string },
        variation_text: "Size: Queen, Color: Navy",
        meta: [{ key: "Size", value: "Queen" }, { key: "Color", value: "Navy" }],
      },
      {
        name: "Espresso Roast Coffee", sku: "COF-002", quantity: 1, qty: 1, price: 20.00, subtotal: 20.00, total: 20.00, tax: 2.00,
        image: "", product_id: 102, variation_id: null,
        variation: Object.assign({}, { text: "" }) as Record<string, string> & { text: string },
        variation_text: "",
        meta: [],
      },
    ],
  };
}