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
<html>
<head>
<meta charset="utf-8">
<title>Invoice {{order.number}}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Inter", "Segoe UI", Arial, sans-serif; color: #232323; font-size: 12px; line-height: 1.45; margin: 0; background: #fff; }

  .invoice { width: 100%; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
  .brand { display: flex; align-items: flex-start; gap: 10px; }
  .brand-logo { width: 48px; height: 48px; object-fit: contain; filter: grayscale(100%); }
  .brand-name { font-size: 44px; line-height: 1; letter-spacing: -0.8px; font-weight: 700; color: #151515; }
  .brand-tagline { margin-top: 2px; font-size: 14px; color: #5a5a5a; letter-spacing: 0.1px; }
  .invoice-head { text-align: right; }
  .invoice-title { font-size: 54px; line-height: 0.95; letter-spacing: 1px; font-weight: 700; color: #111; }
  .invoice-number { margin-top: 8px; font-size: 25px; font-weight: 600; color: #222; }
  .rule { margin: 18px 0 14px; border-top: 2px solid #bdbdbd; }

  .meta-grid { display: table; width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 14px; }
  .meta-col { display: table-cell; width: 33.333%; padding: 8px 14px 10px 0; vertical-align: top; border-right: 1px solid #d6d6d6; }
  .meta-col:last-child { border-right: 0; padding-right: 0; padding-left: 14px; }
  .meta-col:nth-child(2) { padding-left: 14px; }
  .meta-label { font-size: 11px; letter-spacing: 0.8px; color: #5f5f5f; font-weight: 700; text-transform: uppercase; margin-top: 8px; }
  .meta-value { font-size: 18px; color: #1f1f1f; margin-top: 2px; font-weight: 500; }

  .section-rule { border-top: 1px dashed #cfcfcf; margin: 10px 0 12px; }
  .party-grid { display: table; width: 100%; table-layout: fixed; margin-bottom: 10px; }
  .party-col { display: table-cell; width: 50%; vertical-align: top; padding-right: 16px; }
  .party-col:last-child { padding-left: 16px; padding-right: 0; border-left: 1px solid #d6d6d6; }
  .section-title { font-size: 11px; letter-spacing: 1.2px; color: #4f4f4f; font-weight: 700; text-transform: uppercase; margin-bottom: 6px; }
  .party-name { font-size: 29px; line-height: 1.05; font-weight: 700; color: #171717; margin-bottom: 6px; letter-spacing: -0.3px; }
  .party-line { font-size: 18px; color: #2a2a2a; margin-bottom: 2px; }

  table.items { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.items thead th { text-align: left; padding: 9px 8px; font-size: 11px; letter-spacing: 0.9px; color: #525252; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #bdbdbd; }
  table.items tbody td { padding: 10px 8px; border-bottom: 1px dashed #d0d0d0; vertical-align: top; }
  table.items tbody tr:last-child td { border-bottom: 1px solid #bdbdbd; }
  .item-col { width: 39%; }
  .sku-col { width: 18%; }
  .qty-col { width: 10%; text-align: center; }
  .unit-col { width: 16%; text-align: right; }
  .total-col { width: 17%; text-align: right; font-weight: 600; }
  .item-wrap { display: flex; gap: 8px; align-items: flex-start; }
  .item-image { width: 48px; height: 48px; object-fit: cover; border-radius: 2px; border: 1px solid #d6d6d6; filter: grayscale(100%); flex-shrink: 0; }
  .item-name { font-size: 16px; line-height: 1.2; font-weight: 700; color: #212121; }
  .item-desc { margin-top: 2px; font-size: 11px; line-height: 1.35; color: #555; }
  .sku { font-size: 14px; line-height: 1.2; color: #2f2f2f; margin-top: 7px; }
  .qty { font-size: 16px; color: #212121; margin-top: 7px; }
  .money { font-size: 16px; color: #212121; margin-top: 7px; }

  .bottom { display: table; width: 100%; table-layout: fixed; margin-top: 10px; }
  .bottom-left { display: table-cell; width: 57%; vertical-align: top; padding-right: 20px; }
  .bottom-right { display: table-cell; width: 43%; vertical-align: top; }
  .notes-body { font-size: 18px; line-height: 1.35; color: #2a2a2a; max-width: 95%; }
  .totals-table { width: 100%; border-collapse: collapse; margin-top: 2px; }
  .totals-table td { padding: 5px 0; font-size: 16px; color: #303030; }
  .totals-table td:last-child { text-align: right; }
  .totals-table .negative { color: #232323; }
  .totals-table .grand td { border-top: 2px solid #bdbdbd; padding-top: 10px; font-size: 37px; line-height: 1; font-weight: 700; color: #111; letter-spacing: -0.5px; }
  .totals-table .grand td:last-child { text-align: right; }

  .footer { margin-top: 16px; border-top: 2px solid #bdbdbd; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .footer-left { display: flex; align-items: center; gap: 8px; color: #262626; font-size: 16px; font-weight: 600; }
  .footer-left img { width: 34px; height: 34px; object-fit: contain; filter: grayscale(100%); }
  .footer-right { font-size: 19px; font-weight: 500; color: #262626; text-align: right; }
</style>
</head>
<body>
  <div class="invoice">
    <div class="top">
      <div class="brand">
        {{#if store.logo}}
          <img src="{{store.logo}}" alt="{{store.name}}" class="brand-logo" />
        {{else}}
          <img src="https://cdn-icons-png.flaticon.com/512/263/263142.png" alt="Store icon" class="brand-logo" />
        {{/if}}
        <div>
          <div class="brand-name">{{default store.name "Minimal Store"}}</div>
          <div class="brand-tagline">{{default store.tagline "Quality Products. Simple Living."}}</div>
        </div>
      </div>
      <div class="invoice-head">
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-number">#{{default order.number "INV-2024-0158"}}</div>
      </div>
    </div>
    <div class="rule"></div>

    <div class="meta-grid">
      <div class="meta-col">
        <div class="meta-label">Invoice Date</div>
        <div class="meta-value">{{date order.created_at "long"}}</div>
        <div class="meta-label">Order Date</div>
        <div class="meta-value">{{date order.date_iso "long"}}</div>
      </div>
      <div class="meta-col">
        <div class="meta-label">Payment Method</div>
        <div class="meta-value">{{default payment.title "Credit Card"}}</div>
        <div class="meta-label">Order Number</div>
        <div class="meta-value">#{{default order.number "10258"}}</div>
      </div>
      <div class="meta-col">
        <div class="meta-label">Customer ID</div>
        <div class="meta-value">#{{default customer.id "CUS-1045"}}</div>
        <div class="meta-label">Shipping Method</div>
        <div class="meta-value">{{default shipping_method.title "Free Shipping"}}</div>
      </div>
    </div>

    <div class="section-rule"></div>

    <div class="party-grid">
      <div class="party-col">
        <div class="section-title">From</div>
        <div class="party-name">{{default store.name "Minimal Store"}}</div>
        <div class="party-line">{{default store.address.line1 "123 Commerce Street"}}</div>
        <div class="party-line">{{default store.address.city "New York"}}, {{default store.address.state "NY"}} {{default store.address.zip "10001"}}, {{default store.address.country "USA"}}</div>
        {{#if store.phone}}<div class="party-line">Phone: {{store.phone}}</div>{{/if}}
        {{#if store.email}}<div class="party-line">Email: {{store.email}}</div>{{/if}}
        {{#if store.website}}<div class="party-line">Website: {{store.website}}</div>{{/if}}
      </div>
      <div class="party-col">
        <div class="section-title">Bill To</div>
        <div class="party-name">{{default billing.name "John Doe"}}</div>
        {{#if billing.address.line1}}<div class="party-line">{{billing.address.line1}}</div>{{/if}}
        {{#if billing.address.line2}}<div class="party-line">{{billing.address.line2}}</div>{{/if}}
        <div class="party-line">{{default billing.city "Springfield"}}, {{default billing.state "IL"}} {{default billing.zip "62704"}}, {{default billing.country "USA"}}</div>
        {{#if billing.email}}<div class="party-line">Email: {{billing.email}}</div>{{/if}}
        {{#if billing.phone}}<div class="party-line">Phone: {{billing.phone}}</div>{{/if}}
      </div>
    </div>
    <div class="section-rule"></div>

    <table class="items">
      <thead>
        <tr>
          <th class="item-col">Item</th>
          <th class="sku-col">SKU</th>
          <th class="qty-col">Quantity</th>
          <th class="unit-col">Unit Price</th>
          <th class="total-col">Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr>
          <td class="item-col">
            <div class="item-wrap">
              {{#if image}}
                <img src="{{image}}" alt="{{name}}" class="item-image" />
              {{else}}
                <img src="https://placehold.co/48x48/e7e7e7/555?text=IMG" alt="{{name}}" class="item-image" />
              {{/if}}
              <div>
                <div class="item-name">{{name}}</div>
                {{#if variation_text}}<div class="item-desc">{{variation_text}}</div>{{/if}}
              </div>
            </div>
          </td>
          <td class="sku-col"><div class="sku">{{default sku "N/A"}}</div></td>
          <td class="qty-col"><div class="qty">{{quantity}}</div></td>
          <td class="unit-col"><div class="money">{{currency price ../order.currency}}</div></td>
          <td class="total-col"><div class="money">{{currency total ../order.currency}}</div></td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    <div class="bottom">
      <div class="bottom-left">
        <div class="section-title">Notes</div>
        <div class="notes-body">
          {{#if order.notes}}
            {{order.notes}}
          {{else}}
            Thank you for your order! If you have any questions, please contact us anytime. We appreciate your business.
          {{/if}}
        </div>
      </div>
      <div class="bottom-right">
        <table class="totals-table">
          <tr><td>Subtotal</td><td>{{currency totals.subtotal order.currency}}</td></tr>
          {{#if (gt totals.discount 0)}}<tr><td>Discount</td><td class="negative">−{{currency totals.discount order.currency}}</td></tr>{{/if}}
          <tr><td>Shipping</td><td>{{currency totals.shipping order.currency}}</td></tr>
          <tr><td>Tax</td><td>{{currency totals.tax order.currency}}</td></tr>
          <tr class="grand"><td>Total</td><td>{{currency totals.total order.currency}}</td></tr>
        </table>
      </div>
    </div>

    <div class="footer">
      <div class="footer-left">
        {{#if store.logo}}
          <img src="{{store.logo}}" alt="{{store.name}}" />
        {{else}}
          <img src="https://cdn-icons-png.flaticon.com/512/263/263142.png" alt="Store icon" />
        {{/if}}
        <span>{{uppercase (default store.name "Woo Commerce")}}</span>
      </div>
      <div class="footer-right">Thank you for shopping with us!</div>
    </div>
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