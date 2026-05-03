import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveMirroredProductImageUrl } from "@/lib/product-image-urls";

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
    /** Site branding logo URL (may differ from logo when invoice_logo_url is set). */
    site_logo_url: string;
    /** Uploaded invoice-only logo URL (empty if using site logo). */
    invoice_logo_url: string;
    /** True when `invoice_logo_url` is set — default invoice shows logo; otherwise site name on the left. */
    has_invoice_logo: boolean;
    /** Display tagline under logo (empty string if not configured on store). */
    tagline: string;
    email: string;
    phone: string;
    website: string;
    url: string;
    currency: string;
    address: AddressNested;
    /** Optional footer links — derived from store.website when set. */
    terms_url: string;
    privacy_url: string;
  };
  order: {
    id: string;
    number: string;
    /** WooCommerce numeric id. */
    woo_id: number;
    /** Same as woo_id, string — use for “Order number” when it must be the Woo id. */
    woo_order_id: string;
    /** Shop-facing invoice # — prefers Woo order_number, then woo_id. */
    invoice_number: string;
    date: string;
    date_iso: string;
    /** ISO timestamp for Handlebars {{date order.created_at}} — same source as date_iso. */
    created_at: string;
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
    status_label: string;
    payment_state: string;
    payment_state_label: string;
    display_status: string;
    /** Visual tone for invoice header status pill (success, info, warning, …). */
    invoice_badge_tone: string;
    /** Inline SVG for pill icon (check / x / etc.) — use {{{payment.invoice_badge_icon}}} in templates. */
    invoice_badge_icon: string;
    transaction_id: string;
  };
  shipping_method: {
    name: string;
    /** Alias of name — templates historically used `.title`. */
    title: string;
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

function absoluteUrlsFromWebsite(website: string): { terms_url: string; privacy_url: string } {
  const w = (website || "").trim();
  if (!/^https?:\/\//i.test(w)) return { terms_url: "", privacy_url: "" };
  try {
    const base = new URL(w);
    const origin = base.origin;
    return {
      terms_url: `${origin}/terms`,
      privacy_url: `${origin}/privacy-policy`,
    };
  } catch {
    return { terms_url: "", privacy_url: "" };
  }
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

function toTitleCaseStatus(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function resolvePaymentStatusLabels(orderStatus: string): {
  status: string;
  statusLabel: string;
  paymentState: string;
  paymentStateLabel: string;
  displayStatus: string;
} {
  const status = String(orderStatus || "").trim().toLowerCase();
  const statusLabel = status ? toTitleCaseStatus(status) : "Pending";
  let paymentState = "pending";
  let paymentStateLabel = "Pending";

  if (status === "completed" || status === "processing" || status === "on-hold") {
    paymentState = "paid";
    paymentStateLabel = "Paid";
  } else if (status === "failed") {
    paymentState = "failed";
    paymentStateLabel = "Failed";
  } else if (status === "refunded" || status === "cancelled") {
    paymentState = "reversed";
    paymentStateLabel = "Reversed";
  }

  const displayStatus =
    statusLabel.toLowerCase() === paymentStateLabel.toLowerCase()
      ? paymentStateLabel
      : `${paymentStateLabel} (${statusLabel})`;

  return { status, statusLabel, paymentState, paymentStateLabel, displayStatus };
}

/** Maps Woo order status → CSS tone when payment-derived tone does not apply. */
function invoiceOrderStatusBadgeTone(orderStatus: string): string {
  const s = String(orderStatus || "").trim().toLowerCase();
  if (s === "completed") return "success";
  if (s === "processing") return "info";
  if (s === "on-hold") return "warning";
  if (s === "pending") return "muted";
  if (s === "failed") return "danger";
  if (s === "cancelled") return "neutral";
  if (s === "refunded") return "violet";
  return "muted";
}

/** Invoice pill color follows payment semantics first — fixes “Paid” + blue (processing) mismatch. */
function invoicePaymentBadgeTone(paymentState: string, orderStatus: string): string {
  const ps = String(paymentState || "").trim().toLowerCase();
  if (ps === "paid") return "success";
  if (ps === "failed") return "danger";
  if (ps === "reversed") return "neutral";
  if (ps === "pending") return "muted";
  return invoiceOrderStatusBadgeTone(String(orderStatus || ""));
}

/** Compact SVG for PDF/HTML invoice pills — uses currentColor (pill supplies semantic color). */
const BADGE_ICON_SVG = {
  /** Check inside a circle ring — reads clearly inside the rounded pill at small sizes. */
  paid: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.35" stroke="currentColor" stroke-width="1.35" fill="none"/><path d="M6.25 10.1l2.35 2.35 5.15-5.15" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
  /** X inside a circle ring — pairs visually with paid. */
  failed: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.35" stroke="currentColor" stroke-width="1.35" fill="none"/><path d="M7.2 7.2l5.6 5.6M12.8 7.2l-5.6 5.6" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/></svg>`,
  reversed: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.35" stroke="currentColor" stroke-width="1.35" fill="none"/><path d="M6.5 10h7" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/></svg>`,
  pending: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.35" stroke="currentColor" stroke-width="1.35" fill="none"/><path d="M10 6.5v3.5l2 1.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`,
  fallback: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.35" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="10" cy="10" r="2.25" fill="currentColor"/></svg>`,
} as const;

function invoiceBadgeIconSvg(paymentState: string): string {
  const ps = String(paymentState || "").trim().toLowerCase();
  if (ps === "paid") return BADGE_ICON_SVG.paid;
  if (ps === "failed") return BADGE_ICON_SVG.failed;
  if (ps === "reversed") return BADGE_ICON_SVG.reversed;
  if (ps === "pending") return BADGE_ICON_SVG.pending;
  return BADGE_ICON_SVG.fallback;
}

function buildVariation(meta: Array<{ key: string; value: string }>): Record<string, string> & { text: string } {
  const obj: Record<string, string> = {};
  const cleaned: Array<{ key: string; value: string }> = [];
  for (const m of meta) {
    const rawKey = String(m.key || "").trim();
    if (!rawKey || rawKey.startsWith("_")) continue;
    const rawValue = String(m.value || "").trim();
    if (!rawValue || rawValue === "[object Object]") continue;
    const cleanedKey = rawKey.replace(/^pa_/, "").replace(/_/g, " ").trim();
    const cleanedValue = rawValue.replace(/\s+/g, " ").trim();
    if (!cleanedKey || !cleanedValue) continue;
    cleaned.push({ key: cleanedKey, value: cleanedValue });
    const k = cleanedKey.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    obj[k] = cleanedValue;
  }
  const text = cleaned.map((m) => `${m.key}: ${m.value}`).join(", ");
  return Object.assign(obj, { text }) as Record<string, string> & { text: string };
}

/**
 * Keep invoice item images lightweight for PDF generation.
 * Many Woo image CDNs (e.g. Optimole) deliver 2K+ by default, which balloons PDF size.
 */
function optimizeInvoiceImageSrc(raw: string): string {
  const src = String(raw || "").trim();
  if (!src) return src;
  // Optimole encoded transform block: /w:2560/h:2560/q:mauto/...
  if (/\.i\.optimole\.com\//i.test(src)) {
    return src.replace(/\/w:\d+\/h:\d+\/q:[^/]+/i, "/w:220/h:260/q:60");
  }
  try {
    const u = new URL(src);
    // Cloudflare Images direct delivery URL => force thumb variant when possible.
    if (/imagedelivery\.net$/i.test(u.hostname)) {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 3) {
        u.pathname = `/${parts[0]}/${parts[1]}/thumb`;
        return u.toString();
      }
    }
    // Generic width/height query params: cap aggressively for invoice thumbs.
    const width = Number(u.searchParams.get("w") || u.searchParams.get("width") || "0");
    if (width > 0) {
      if (u.searchParams.has("w")) u.searchParams.set("w", "220");
      if (u.searchParams.has("width")) u.searchParams.set("width", "220");
      if (u.searchParams.has("h")) u.searchParams.set("h", "260");
      if (u.searchParams.has("height")) u.searchParams.set("height", "260");
      if (u.searchParams.has("q")) u.searchParams.set("q", "60");
      if (u.searchParams.has("quality")) u.searchParams.set("quality", "60");
      return u.toString();
    }
    return src;
  } catch {
    return src;
  }
}

export async function resolveOrderContext(
  supabase: SupabaseClient,
  storeId: string,
  orderId: string,
  templateMeta: { name: string; type: string },
): Promise<OrderContext> {
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", orderId).eq("store_id", storeId).maybeSingle();
  if (error) throw error;
  if (!order) throw new Error("Order not found");

  const { data: store } = await supabase
    .from("stores")
    .select("name, url, logo_url, invoice_logo_url, currency, support_email, phone, website, address")
    .eq("id", storeId)
    .maybeSingle();

  const billingRaw = (order.billing as Record<string, unknown>) || {};
  const shippingRaw = (order.shipping as Record<string, unknown>) || {};
  const itemsRaw = Array.isArray(order.line_items) ? (order.line_items as Record<string, unknown>[]) : [];
  const shippingLines = Array.isArray(order.shipping_lines) ? (order.shipping_lines as Record<string, unknown>[]) : [];
  const rawData = (order.raw_data as Record<string, unknown>) || {};
  const metaData = Array.isArray(rawData.meta_data) ? (rawData.meta_data as Array<{ key: string; value: unknown }>) : [];
  const cloudflareEnabled =
    process.env.NEXT_PUBLIC_CLOUDFLARE_PRODUCT_IMAGES === "true" ||
    process.env.CLOUDFLARE_PRODUCT_IMAGES === "true";
  const wooProductIds = [...new Set(itemsRaw.map((it) => Number(it.product_id || 0)).filter((id) => Number.isFinite(id) && id > 0))];
  const mirrorByWooId = new Map<number, unknown>();
  if (cloudflareEnabled && wooProductIds.length > 0) {
    const { data: mirrorRows } = await supabase
      .from("products")
      .select("woo_id, image_mirror_urls")
      .eq("store_id", storeId)
      .in("woo_id", wooProductIds);
    for (const row of mirrorRows || []) {
      const wooId = Number(row.woo_id || 0);
      if (wooId > 0) mirrorByWooId.set(wooId, row.image_mirror_urls);
    }
  }

  const currency = String(order.currency || store?.currency || "USD");
  const billing = asAddress(billingRaw);
  const shipping = asAddress(Object.keys(shippingRaw).length ? shippingRaw : billingRaw);

  const subtotal = itemsRaw.reduce((s, it) => s + Number(it.subtotal || it.total || 0), 0);
  const shipMethod = shippingLines[0] || {};
  const shipMeta = Array.isArray(shipMethod.meta_data) ? (shipMethod.meta_data as Array<{ key: string; value: unknown }>) : [];
  const tracking = String(shipMeta.find((m) => /tracking/i.test(String(m.key)))?.value || "");

  const metaLookup = (key: RegExp): string => String(metaData.find((m) => key.test(String(m.key || "")))?.value ?? "");

  const storeAddress = asStoreAddress(store?.address as Record<string, unknown> | null);
  const websiteStr = String(store?.website || store?.url || "");
  const linkUrls = absoluteUrlsFromWebsite(websiteStr);
  const dateIso = order.date_created ? new Date(order.date_created as string).toISOString() : "";
  const wooIdNum = Number(order.woo_id ?? 0);
  const invNum = String(order.order_number?.trim() || order.woo_id || order.id);
  const wooOrderIdStr = String(order.woo_id ?? "");
  const paymentStatus = resolvePaymentStatusLabels(String(order.status || ""));

  const siteLogo = String(store?.logo_url || "").trim();
  const invoiceOnly = String(store?.invoice_logo_url || "").trim();
  const effectiveInvoiceLogo = invoiceOnly || siteLogo;

  return {
    store: {
      name: String(store?.name || "Store"),
      logo: effectiveInvoiceLogo,
      logo_url: effectiveInvoiceLogo,
      site_logo_url: siteLogo,
      invoice_logo_url: invoiceOnly,
      has_invoice_logo: invoiceOnly.length > 0,
      tagline: "",
      email: String(store?.support_email || ""),
      phone: String(store?.phone || ""),
      website: websiteStr,
      url: String(store?.url || ""),
      currency,
      address: storeAddress,
      terms_url: linkUrls.terms_url,
      privacy_url: linkUrls.privacy_url,
    },
    order: {
      id: String(order.id),
      number: invNum,
      woo_id: wooIdNum,
      woo_order_id: wooOrderIdStr,
      invoice_number: order.order_number?.trim()
        ? String(order.order_number.trim())
        : String(order.woo_id || order.id),
      date: order.date_created ? new Date(order.date_created as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
      date_iso: dateIso,
      created_at: dateIso,
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
      status: paymentStatus.status,
      status_label: paymentStatus.statusLabel,
      payment_state: paymentStatus.paymentState,
      payment_state_label: paymentStatus.paymentStateLabel,
      display_status: paymentStatus.displayStatus,
      invoice_badge_tone: invoicePaymentBadgeTone(paymentStatus.paymentState, String(order.status || "")),
      invoice_badge_icon: invoiceBadgeIconSvg(paymentStatus.paymentState),
      transaction_id: String(rawData.transaction_id || ""),
    },
    shipping_method: {
      name: String(shipMethod.method_title || ""),
      title: String(shipMethod.method_title || ""),
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
      const baseImage = optimizeInvoiceImageSrc(((it.image as { src?: string } | undefined)?.src) || "");
      const productId = it.product_id ? Number(it.product_id) : null;
      const mirroredImage =
        cloudflareEnabled && baseImage && productId
          ? resolveMirroredProductImageUrl(baseImage, mirrorByWooId.get(productId), "thumb") || baseImage
          : baseImage;
      return {
        name: String(it.name || ""),
        sku: String(it.sku || ""),
        quantity: Number(it.quantity || 0),
        qty: Number(it.quantity || 0),
        price: Number(it.price || 0),
        subtotal: Number(it.subtotal || it.total || 0),
        total: Number(it.total || 0),
        tax: Number(it.total_tax || 0),
        image: mirroredImage,
        product_id: productId,
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
      name: "Sample Store",
      logo: "",
      logo_url: "",
      site_logo_url: "",
      invoice_logo_url: "",
      has_invoice_logo: false,
      tagline: "",
      email: "support@sample.store",
      phone: "+1 555 0100",
      website: "https://sample.store",
      url: "https://sample.store",
      currency: "USD",
      address: { line1: "100 Main Street", line2: "", city: "Springfield", state: "IL", country: "United States", zip: "62704" },
      terms_url: "https://sample.store/terms",
      privacy_url: "https://sample.store/privacy-policy",
    },
    order: {
      id: "sample-1",
      number: "1024",
      woo_id: 138327,
      woo_order_id: "138327",
      invoice_number: "1024",
      date: "May 22, 2024",
      date_iso: "2024-05-22T10:30:00Z",
      created_at: "2024-05-22T10:30:00Z",
      status: "processing",
      currency: "USD",
      currency_symbol: "$",
      notes: "Please leave at the front door.",
      customer_note: "Please leave at the front door.",
      transaction_id: "ch_3OqXyZ2eZvKYlo2C1abc",
      payment_method: "stripe",
      payment_method_title: "Credit Card (Stripe)",
      total: 88.80,
      subtotal: 78.00,
      tax_total: 7.80,
      shipping_total: 8.00,
      discount_total: 5.00,
    },
    billing,
    shipping,
    customer: { id: 42, name: "Sarah Johnson", first_name: "Sarah", last_name: "Johnson", email: "sarah@example.com", phone: "+1 555 0123" },
    payment: {
      method: "stripe",
      title: "Credit Card (Stripe)",
      status: "processing",
      status_label: "Processing",
      payment_state: "paid",
      payment_state_label: "Paid",
      display_status: "Paid (Processing)",
      invoice_badge_tone: "success",
      invoice_badge_icon: BADGE_ICON_SVG.paid,
      transaction_id: "ch_3OqXyZ2eZvKYlo2C1abc",
    },
    shipping_method: { name: "Standard Shipping", title: "Standard Shipping", tracking_number: "1Z999AA10123456784" },
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