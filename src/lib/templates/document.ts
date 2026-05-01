export type TemplateType = "invoice" | "pickslip" | "report";

export type PageSize = "A4" | "Letter" | "Legal" | "A3" | "A5";
export type PageOrientation = "portrait" | "landscape";

export interface PageBox {
  /** millimetres */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PageSettings {
  size?: PageSize;
  orientation?: PageOrientation;
  /** Outer print margin (paper edge → content area). */
  margin?: PageBox;
  /** Inner padding applied to <body> (extra content inset, in mm). */
  padding?: PageBox;
  /** Page background colour (CSS color). */
  background?: string;
}

/** Persisted template document: full `html` is what Puppeteer renders after Handlebars. */
export interface TemplateConfig {
  html: string;
  /** GrapesJS exported CSS (also merged into `html` on save). */
  css?: string;
  /** Round-trip GrapesJS project — optional for legacy HTML-only templates. */
  grapesProject?: Record<string, unknown>;
  /** Optional pattern for PDF download name, e.g. `invoice-{{order.number}}`. */
  filenamePattern?: string;
  /** Page-level layout settings (size, margins, background, padding). */
  page?: PageSettings;
}

export const DEFAULT_PAGE_SETTINGS: Required<PageSettings> = {
  size: "A4",
  orientation: "portrait",
  margin: { top: 14, right: 14, bottom: 14, left: 14 },
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  background: "#ffffff",
};

/** Page dimensions in millimetres (portrait long edge). */
export const PAGE_DIMENSIONS_MM: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
};

export function resolvePageSettings(p?: PageSettings): Required<PageSettings> {
  return {
    size: p?.size ?? DEFAULT_PAGE_SETTINGS.size,
    orientation: p?.orientation ?? DEFAULT_PAGE_SETTINGS.orientation,
    margin: { ...DEFAULT_PAGE_SETTINGS.margin, ...(p?.margin ?? {}) },
    padding: { ...DEFAULT_PAGE_SETTINGS.padding, ...(p?.padding ?? {}) },
    background: p?.background ?? DEFAULT_PAGE_SETTINGS.background,
  };
}

/** Visual page dimensions accounting for orientation. */
export function pageDimensionsMm(p?: PageSettings): { width: number; height: number } {
  const { size, orientation } = resolvePageSettings(p);
  const dims = PAGE_DIMENSIONS_MM[size];
  return orientation === "landscape"
    ? { width: dims.height, height: dims.width }
    : { width: dims.width, height: dims.height };
}

/** CSS that controls actual print output (used by Puppeteer). */
export function pagePrintCss(p?: PageSettings): string {
  const r = resolvePageSettings(p);
  const m = r.margin;
  const pad = r.padding;
  return `@page { size: ${r.size} ${r.orientation}; margin: ${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm; }
  body { background: ${r.background}; padding: ${pad.top}mm ${pad.right}mm ${pad.bottom}mm ${pad.left}mm; }`;
}

const PRINT_BASE_CSS = `* { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.5; margin: 0; }`;

/** Merge Grapes body HTML + CSS into a single printable document (server + preview). */
export function mergePrintDocument(opts: {
  bodyHtml: string;
  css?: string;
  title?: string;
  page?: PageSettings;
}): string {
  const title = (opts.title || "Document").replace(/</g, "");
  const css = [pagePrintCss(opts.page), PRINT_BASE_CSS, opts.css?.trim() || ""]
    .filter(Boolean)
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${css}</style>
</head>
<body>${opts.bodyHtml}</body>
</html>`;
}

/** True if document looks like a full HTML document (legacy Monaco templates). */
export function isFullHtmlDocument(html: string): boolean {
  const t = html.trim().toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html");
}

export interface TemplateRow {
  id: string;
  client_id: string;
  name: string;
  type: TemplateType;
  description: string | null;
  is_sample: boolean;
  is_default_for_type: boolean;
  current_version_id: string | null;
  schema_version: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateVersionRow {
  id: string;
  template_id: string;
  version_number: number;
  document: TemplateConfig;
  styles: Record<string, unknown>;
  change_note: string | null;
  created_at: string;
}

export function blankInvoiceHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice {{order.invoice_number}}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #111827;
    font-size: 12px;
    line-height: 1.45;
    margin: 0;
    background: #fff;
  }
  .inv { max-width: 100%; }
  .inv-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 4px;
  }
  .inv-logo {
    max-height: 56px;
    max-width: 240px;
    object-fit: contain;
    display: block;
  }
  .inv-header-right {
    text-align: right;
    font-size: 12px;
    color: #111827;
  }
  .inv-store-name {
    font-weight: 700;
    font-size: 14px;
    margin-bottom: 4px;
  }
  .inv-store-email {
    color: #374151;
  }
  .inv-title {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: 0.06em;
    margin: 14px 0 18px;
    text-transform: uppercase;
    color: #111827;
  }
  .inv-columns {
    display: table;
    width: 100%;
    table-layout: fixed;
    margin-bottom: 20px;
    border-collapse: collapse;
  }
  .inv-billing,
  .inv-meta {
    display: table-cell;
    vertical-align: top;
    width: 50%;
  }
  .inv-billing {
    padding-right: 20px;
  }
  .inv-meta {
    padding-left: 20px;
  }
  .inv-section-head {
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 10px;
    color: #111827;
  }
  .inv-dl dt {
    font-weight: 700;
    font-size: 11px;
    color: #374151;
    margin: 0;
    padding-top: 6px;
  }
  .inv-dl dd {
    margin: 0 0 4px 0;
    font-size: 12px;
    color: #111827;
  }
  .inv-meta .inv-dl dt {
    padding-top: 5px;
  }

  table.inv-items {
    width: 100%;
    border-collapse: collapse;
    margin: 4px 0 14px;
    table-layout: fixed;
  }
  table.inv-items thead {
    display: table-header-group;
  }
  table.inv-items thead th {
    background: #000;
    color: #fff;
    text-align: left;
    padding: 10px 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  table.inv-items thead th.col-qty,
  table.inv-items thead th.col-price {
    text-align: right;
  }
  table.inv-items tbody td {
    padding: 10px 12px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
    font-size: 12px;
  }
  table.inv-items tbody tr {
    page-break-inside: avoid;
  }
  table.inv-items .col-qty,
  table.inv-items .col-price {
    text-align: right;
    white-space: nowrap;
  }
  .inv-product-name {
    font-weight: 600;
    color: #111827;
  }
  .inv-variation {
    font-size: 11px;
    color: #6b7280;
    margin-top: 2px;
  }

  .inv-totals-wrap {
    display: flex;
    justify-content: flex-end;
    page-break-inside: avoid;
    margin-top: 4px;
  }
  .inv-totals {
    width: 100%;
    max-width: 300px;
  }
  .inv-total-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 3px 0;
    font-size: 12px;
    color: #374151;
  }
  .inv-total-row span:last-child {
    font-weight: 500;
    color: #111827;
    text-align: right;
  }
  .inv-ship-note {
    font-size: 10px;
    color: #6b7280;
    margin: -2px 0 8px;
    text-align: right;
  }
  .inv-grand {
    border-top: 2px solid #111827;
    border-bottom: 2px solid #111827;
    padding: 10px 0 !important;
    margin-top: 6px;
    font-weight: 800;
    font-size: 14px;
    color: #111827 !important;
  }
  .inv-pay-note {
    margin-top: 12px;
    font-size: 11px;
    color: #374151;
    text-align: right;
  }

  .inv-footer {
    margin-top: 26px;
    padding-top: 14px;
    border-top: 1px solid #d1d5db;
    text-align: center;
    font-size: 11px;
    page-break-inside: avoid;
  }
  .inv-footer a {
    color: #2563eb;
    text-decoration: none;
  }
  .inv-footer-muted {
    color: #9ca3af;
  }
  .inv-generated {
    margin-top: 10px;
    font-size: 10px;
    color: #9ca3af;
    text-align: center;
  }
</style>
</head>
<body>
<div class="inv">
  <header class="inv-header">
    <div class="inv-header-left">
      {{#if store.logo}}
        <img class="inv-logo" src="{{store.logo}}" alt="{{store.name}}" />
      {{else}}
        <div class="inv-store-name" style="font-size:17px;font-weight:800">{{store.name}}</div>
      {{/if}}
    </div>
    <div class="inv-header-right">
      <div class="inv-store-name">{{store.name}}</div>
      {{#if store.email}}<div class="inv-store-email">{{store.email}}</div>{{/if}}
    </div>
  </header>

  <h1 class="inv-title">Invoice</h1>

  <div class="inv-columns">
    <div class="inv-billing">
      <div class="inv-section-head">Billing Details</div>
      <dl class="inv-dl">
        <dt>Name</dt><dd>{{default billing.name "—"}}</dd>
        <dt>Country</dt><dd>{{default billing.country "—"}}</dd>
        <dt>Area</dt><dd>{{default billing.city "—"}}</dd>
        <dt>Street</dt><dd>{{default billing.address.line1 "—"}}</dd>
        <dt>Block</dt><dd>{{default billing.address.line2 "—"}}</dd>
        <dt>Avenue</dt><dd>{{default billing.state "—"}}</dd>
        <dt>Phone</dt><dd>{{default billing.phone "—"}}</dd>
        <dt>Email</dt><dd>{{default billing.email "—"}}</dd>
      </dl>
    </div>
    <div class="inv-meta">
      <dl class="inv-dl">
        <dt>Invoice Number</dt><dd>{{order.invoice_number}}</dd>
        <dt>Invoice Date</dt><dd>{{date order.date_iso "long"}}</dd>
        <dt>Order Number</dt><dd>{{order.woo_order_id}}</dd>
        <dt>Order Date</dt><dd>{{date order.date_iso "long"}}</dd>
        <dt>Payment Method</dt><dd>{{default payment.title "—"}}</dd>
      </dl>
    </div>
  </div>

  <table class="inv-items">
    <thead>
      <tr>
        <th style="width:58%">Product</th>
        <th class="col-qty" style="width:14%">Quantity</th>
        <th class="col-price" style="width:28%">Price</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td>
          <div class="inv-product-name">{{name}}</div>
          {{#if variation_text}}<div class="inv-variation">{{variation_text}}</div>{{/if}}
        </td>
        <td class="col-qty">{{quantity}}</td>
        <td class="col-price">{{currency price ../order.currency}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="inv-totals-wrap">
    <div class="inv-totals">
      <div class="inv-total-row"><span>Subtotal</span><span>{{currency totals.subtotal order.currency}}</span></div>
      {{#if (gt totals.discount 0)}}
      <div class="inv-total-row"><span>Discount</span><span>−{{currency totals.discount order.currency}}</span></div>
      {{/if}}
      <div class="inv-total-row"><span>Shipping</span><span>{{currency totals.shipping order.currency}}</span></div>
      {{#if shipping_method.name}}
      <div class="inv-ship-note">via {{shipping_method.name}}</div>
      {{/if}}
      {{#if (gt totals.tax 0)}}
      <div class="inv-total-row"><span>Tax</span><span>{{currency totals.tax order.currency}}</span></div>
      {{/if}}
      <div class="inv-total-row inv-grand"><span>Total</span><span>{{currency totals.total order.currency}}</span></div>
      <div class="inv-pay-note">Payment method: {{default payment.title "—"}}</div>
    </div>
  </div>

  <footer class="inv-footer">
    {{#if store.terms_url}}
      <a href="{{store.terms_url}}" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a>
      <span class="inv-footer-muted"> | </span>
      <a href="{{store.privacy_url}}" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
    {{else}}
      <span class="inv-footer-muted">Terms &amp; Conditions | Privacy Policy</span>
    {{/if}}
    <div class="inv-generated">Generated {{meta.printed_at}}</div>
  </footer>
</div>
</body>
</html>`;
}

export function blankPickslipHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Pick Slip {{order.number}}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #000; font-size: 12px; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
  h1 { font-size: 24px; margin: 0; font-weight: 800; letter-spacing: -0.5px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 6px; background: #000; color: #fff; font-size: 11px; text-transform: uppercase; }
  td { padding: 10px 6px; border-bottom: 1px solid #ddd; }
  .qty { font-size: 18px; font-weight: 700; text-align: center; width: 60px; background: #f5f5f5; }
  .sku { font-family: monospace; font-size: 13px; }
  .signature { margin-top: 40px; border-top: 1px solid #000; padding-top: 8px; width: 240px; font-size: 11px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>PICK SLIP</h1>
      <div>Order #{{order.number}} · {{order.date}}</div>
      <div>{{customer.full_name}}</div>
    </div>
    <div style="text-align:right">
      {{barcode order.number format="code128" height=14}}
    </div>
  </div>

  <table>
    <thead><tr><th>SKU</th><th>Item</th><th style="text-align:center">Qty</th></tr></thead>
    <tbody>
      {{#each items}}
      <tr>
        <td class="sku">{{sku}}</td>
        <td>{{name}}{{#each meta}}<div style="color:#666;font-size:10px">{{key}}: {{value}}</div>{{/each}}</td>
        <td class="qty">{{qty}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div style="margin-top:24px">
    <strong>Ship to:</strong>
    <div>{{address shipping}}</div>
  </div>

  <div class="signature">Picked by ____________________</div>
</body>
</html>`;
}

export function blankReportHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{report.title}}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; font-size: 12px; margin: 0; }
  h1 { font-size: 22px; margin: 0 0 8px 0; }
  .meta { color: #64748b; font-size: 11px; margin-bottom: 20px; }
  table.report { width: 100%; border-collapse: collapse; }
  table.report th { text-align: left; padding: 10px 12px; background: #0f172a; color: #fff; font-size: 10px; text-transform: uppercase; }
  table.report td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
  table.report td.right { text-align: right; }
  .summary { margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; max-width: 360px; margin-left: auto; }
</style>
</head>
<body>
  <h1>{{report.title}}</h1>
  <div class="meta">{{store.name}} · {{report.generated_at}}{{#if report.period_label}} · {{report.period_label}}{{/if}}</div>
  <table class="report">
    <thead>
      <tr>
        <th>Order</th>
        <th>Date</th>
        <th>Customer</th>
        <th class="right">Total</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {{#each rows}}
      <tr>
        <td>{{order_number}}</td>
        <td>{{date}}</td>
        <td>{{customer}}</td>
        <td class="right">{{currency total ../report.currency}}</td>
        <td>{{status}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <div class="summary">
    <strong>Orders:</strong> {{summary.order_count}}<br/>
    <strong>Revenue:</strong> {{currency summary.revenue report.currency}}
  </div>
</body>
</html>`;
}