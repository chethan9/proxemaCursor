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
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice {{order.invoice_number}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #0f1729;
    --ink-soft: #475569;
    --ink-mute: #94a3b8;
    --line: #e5e7eb;
    --line-soft: #f1f5f9;
    --paper: #ffffff;
    --bg: #f8fafc;
    --thumb-bg: #f5f5f4;
  }
  @page { size: A4; margin: 9mm 9mm 9mm 9mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: 100%; }
  body {
    min-height: 100vh;
    margin: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    font-family: Poppins, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    color: var(--ink);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .beam-outer {
    display: block;
    padding: 12px 8px;
    width: 100%;
    box-sizing: border-box;
  }
  .beam-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 820px;
    min-height: calc(100vh - 24px);
    background: var(--paper);
    padding: 24px 30px;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(15, 23, 41, 0.04), 0 8px 24px -8px rgba(15, 23, 41, 0.08);
    margin: 0 auto;
  }
  .beam-main {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .beam-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 6px;
    gap: 12px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 6px;
  }
  .beam-brand {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    flex: 1 1 auto;
    justify-content: flex-end;
    align-items: flex-start;
    text-align: left;
    padding-top: 8px;
  }
  .beam-site-name {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--ink);
    line-height: 1.2;
    max-width: min(360px, 55vw);
    align-self: flex-start;
    text-align: left;
  }
  .beam-tagline {
    font-size: 11px;
    color: var(--ink-soft);
    font-style: italic;
    letter-spacing: 0.02em;
  }
  .beam-logo {
    max-height: 52px;
    max-width: 220px;
    object-fit: contain;
    display: block;
    align-self: flex-start;
  }
  .beam-header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    color: var(--ink);
    flex-shrink: 0;
    text-align: right;
  }
  .beam-header-right .beam-email {
    font-size: 12px;
    font-weight: 400;
    color: var(--ink-soft);
    margin: 0;
  }
  .beam-title {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.02em;
    text-transform: uppercase;
    color: var(--ink);
    line-height: 1.05;
    margin-top: 0;
  }
  .beam-invoice-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 0;
  }
  .beam-invoice-id {
    font-size: 14px;
    color: var(--ink-soft);
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .beam-invoice-id--hero {
    font-size: 17px;
    color: var(--ink);
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .beam-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.2;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .beam-status-pill__glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
  }
  .beam-status-pill__glyph svg {
    display: block;
    width: 16px;
    height: 16px;
  }
  .beam-status-pill__label {
    line-height: 1.2;
  }
  .beam-status-pill--success {
    background: #d1fae5;
    border-color: #34d399;
    color: #047857;
  }
  .beam-status-pill--info {
    background: #dbeafe;
    border-color: #60a5fa;
    color: #1e40af;
  }
  .beam-status-pill--warning {
    background: #fef3c7;
    border-color: #fbbf24;
    color: #92400e;
  }
  .beam-status-pill--muted {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #475569;
  }
  .beam-status-pill--danger {
    background: #fee2e2;
    border-color: #f87171;
    color: #991b1b;
  }
  .beam-status-pill--neutral {
    background: #f4f4f5;
    border-color: #d4d4d8;
    color: #3f3f46;
  }
  .beam-status-pill--violet {
    background: #ede9fe;
    border-color: #a78bfa;
    color: #5b21b6;
  }
  /* Thank-you (top-left) + subtotal rows (top-right); payment (bottom-left) + grand total (bottom-right) share one row with the thick divider. */
  .beam-settlement-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    grid-template-rows: auto auto;
    column-gap: 28px;
    row-gap: 0;
    margin-top: 4px;
    page-break-inside: avoid;
    align-items: stretch;
  }
  .beam-cell-note {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    align-self: start;
    text-align: left;
  }
  .beam-cell-total-rows {
    grid-column: 2;
    grid-row: 1;
    align-self: start;
    justify-self: stretch;
    width: 100%;
  }
  .beam-cell-payment {
    grid-column: 1;
    grid-row: 2;
    align-self: end;
    min-width: 0;
    text-align: left;
    padding-top: 6px;
  }
  .beam-cell-grand {
    grid-column: 2;
    grid-row: 2;
    align-self: end;
    width: 100%;
  }
  .beam-payment-foot {
    font-size: 12px;
    color: var(--ink-soft);
    font-weight: 500;
    line-height: 1.35;
    word-break: break-word;
  }
  .beam-payment-foot strong {
    font-weight: 600;
    color: var(--ink);
  }
  .beam-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 36px;
    row-gap: 14px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 14px;
  }
  .beam-details > div {
    min-width: 0;
    padding-right: 8px;
  }
  .beam-details > div:last-child {
    padding-right: 0;
    padding-left: 8px;
    border-left: 1px solid var(--line-soft);
  }
  .beam-section-head {
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 5px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink);
  }
  .beam-info {
    margin-bottom: 7px;
    display: flex;
    gap: 10px;
    align-items: baseline;
    line-height: 1.35;
  }
  .beam-info:last-child { margin-bottom: 0; }
  .beam-info-label {
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
    color: var(--ink);
  }
  .beam-info-value {
    font-size: 12px;
    color: var(--ink-soft);
  }
  table.beam-items {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 10px;
    table-layout: fixed;
  }
  table.beam-items thead { display: table-header-group; }
  table.beam-items thead th {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink-mute);
    padding: 7px 0;
    border-bottom: 1px solid var(--line);
    text-align: left;
  }
  table.beam-items thead th.col-sku { width: 120px; text-align: left; }
  table.beam-items thead th.col-qty { text-align: center; width: 80px; }
  table.beam-items thead th.col-unit { text-align: right; width: 110px; }
  table.beam-items thead th.col-total { text-align: right; width: 120px; }
  table.beam-items tbody td {
    padding: 7px 0;
    border-bottom: 1px solid var(--line-soft);
    vertical-align: middle;
    font-size: 14px;
  }
  table.beam-items tbody tr { page-break-inside: avoid; }
  .beam-product-cell {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }
  .beam-thumb {
    width: 40px;
    height: 48px;
    border-radius: 3px;
    background: var(--thumb-bg);
    flex-shrink: 0;
    overflow: hidden;
    border: 1px solid var(--line);
  }
  .beam-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
  }
  .beam-thumb-empty { width: 100%; height: 100%; background: var(--line-soft); }
  .beam-product-name {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 1px;
    color: var(--ink);
    word-break: break-word;
  }
  .beam-variation {
    font-size: 10px;
    color: var(--ink-mute);
  }
  .beam-qty {
    text-align: center;
    font-size: 13px;
    color: var(--ink-soft);
  }
  .beam-sku {
    font-size: 11px;
    color: var(--ink-soft);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    word-break: break-word;
  }
  .beam-unit,
  .beam-total {
    text-align: right;
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    color: var(--ink);
  }
  .beam-price-compare {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.2;
    gap: 1px;
  }
  .beam-price-old {
    font-size: 11px;
    color: var(--ink-mute);
    text-decoration: line-through;
  }
  .beam-price-new {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
  }
  .beam-note {
    margin-top: 8px;
    margin-bottom: 0;
    font-size: 12px;
    color: var(--ink-soft);
    border-top: 1px dashed var(--line);
    padding-top: 8px;
    flex-shrink: 0;
  }
  .beam-totals {
    width: 100%;
    max-width: 280px;
  }
  .beam-total-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 12px;
    gap: 16px;
  }
  .beam-total-row .beam-lbl { color: var(--ink-soft); }
  .beam-total-row .beam-val { font-weight: 500; color: var(--ink); text-align: right; }
  .beam-ship-val { display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
  .beam-ship-val small {
    display: block;
    font-size: 10px;
    color: var(--ink-mute);
    font-weight: 400;
    margin-top: 1px;
  }
  .beam-grand {
    display: flex;
    justify-content: space-between;
    padding-top: 8px;
    margin-top: 4px;
    border-top: 2px solid var(--ink);
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }
  .beam-footer {
    margin-top: auto;
    flex-shrink: 0;
    padding-top: 8px;
    border-top: 1px solid var(--line);
    text-align: right;
    font-size: 12px;
    color: var(--ink-soft);
    page-break-inside: avoid;
  }
  .beam-footer-pay strong { font-weight: 600; color: var(--ink); }
  .beam-footer-links {
    margin-top: 8px;
    text-align: center;
    font-size: 11px;
  }
  .beam-footer-links a {
    color: #2563eb;
    text-decoration: none;
  }
  .beam-footer-muted { color: var(--ink-mute); }
  .beam-generated {
    margin-top: 7px;
    font-size: 10px;
    color: var(--ink-mute);
    text-align: center;
  }
  @media print {
    html { height: 100%; }
    body {
      background: #fff !important;
      padding: 0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .beam-outer {
      padding: 0;
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .beam-card {
      box-shadow: none;
      border-radius: 0;
      max-width: none;
      padding: 0;
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .beam-main {
      flex: 1 1 auto;
    }
    .beam-footer {
      margin-top: auto;
    }
  }
  @media (max-width: 640px) {
    .beam-card { padding: 14px 12px; min-height: auto; }
    .beam-details {
      grid-template-columns: 1fr;
      column-gap: 0;
      row-gap: 20px;
    }
    .beam-details > div:last-child {
      padding-left: 0;
      border-left: none;
      border-top: 1px solid var(--line-soft);
      padding-top: 16px;
    }
    .beam-title { font-size: 22px; }
    .beam-totals { max-width: 100%; }
    .beam-settlement-grid {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto auto;
      row-gap: 10px;
    }
    .beam-cell-note { grid-column: 1; grid-row: 1; }
    .beam-cell-total-rows { grid-column: 1; grid-row: 2; }
    .beam-cell-payment { grid-column: 1; grid-row: 3; padding-top: 0; }
    .beam-cell-grand { grid-column: 1; grid-row: 4; }
    .beam-thumb { width: 34px; height: 40px; }
  }
</style>
</head>
<body>
<div class="beam-outer">
  <div class="beam-card">
    <div class="beam-main">
      <header class="beam-header">
        <div class="beam-brand">
          {{#if store.tagline}}<span class="beam-tagline">{{store.tagline}}</span>{{/if}}
          {{#if store.has_invoice_logo}}
            {{#ifFilled store.invoice_logo_url}}
            <img class="beam-logo" src="{{store.invoice_logo_url}}" alt="{{store.name}}" />
            {{/ifFilled}}
          {{else}}
            <div class="beam-site-name">{{store.name}}</div>
          {{/if}}
        </div>
        <div class="beam-header-right">
          {{#ifFilled order.invoice_number}}
          <div class="beam-invoice-meta">
            <span class="beam-invoice-id beam-invoice-id--hero">#{{order.invoice_number}}</span>
          </div>
          {{/ifFilled}}
          <span class="beam-status-pill beam-status-pill--{{payment.invoice_badge_tone}}">
            <span class="beam-status-pill__glyph">{{{payment.invoice_badge_icon}}}</span>
            <span class="beam-status-pill__label">{{payment.payment_state_label}}</span>
          </span>
          <div class="beam-title">Invoice</div>
        </div>
      </header>

      <section class="beam-details">
        <div>
          <div class="beam-section-head">Billing Details</div>
          {{#ifFilled billing.name}}<div class="beam-info"><span class="beam-info-label">Name:</span><span class="beam-info-value">{{billing.name}}</span></div>{{/ifFilled}}
          {{#ifFilled billing.country}}<div class="beam-info"><span class="beam-info-label">Country:</span><span class="beam-info-value">{{billing.country}}</span></div>{{/ifFilled}}
          {{#ifFilled billing.city}}<div class="beam-info"><span class="beam-info-label">Area:</span><span class="beam-info-value">{{billing.city}}</span></div>{{/ifFilled}}
          {{#ifFilled billing.address.line1}}<div class="beam-info"><span class="beam-info-label">Street:</span><span class="beam-info-value">{{billing.address.line1}}</span></div>{{/ifFilled}}
          {{#ifFilled billing.address.line2}}<div class="beam-info"><span class="beam-info-label">Block:</span><span class="beam-info-value">{{billing.address.line2}}</span></div>{{/ifFilled}}
          {{#ifFilled billing.company}}<div class="beam-info"><span class="beam-info-label">Apartment:</span><span class="beam-info-value">{{billing.company}}</span></div>{{/ifFilled}}
          {{#ifFilled billing.phone}}<div class="beam-info"><span class="beam-info-label">Phone:</span><span class="beam-info-value">{{billing.phone}}</span></div>{{/ifFilled}}
          {{#ifFilled billing.email}}<div class="beam-info"><span class="beam-info-label">Email:</span><span class="beam-info-value">{{billing.email}}</span></div>{{/ifFilled}}
        </div>
        <div>
          {{#ifFilled order.invoice_number}}<div class="beam-info"><span class="beam-info-label">Invoice Number:</span><span class="beam-info-value">{{order.invoice_number}}</span></div>{{/ifFilled}}
          {{#ifFilled order.date_iso}}<div class="beam-info"><span class="beam-info-label">Invoice Date:</span><span class="beam-info-value">{{date order.date_iso "long"}}</span></div>{{/ifFilled}}
          {{#ifFilled order.woo_order_id}}<div class="beam-info"><span class="beam-info-label">Order Number:</span><span class="beam-info-value">{{order.woo_order_id}}</span></div>{{/ifFilled}}
          {{#ifFilled order.date_iso}}<div class="beam-info"><span class="beam-info-label">Order Date:</span><span class="beam-info-value">{{date order.date_iso "long"}}</span></div>{{/ifFilled}}
        </div>
      </section>

      <table class="beam-items">
        <thead>
          <tr>
            <th>Item</th>
            <th class="col-sku">SKU</th>
            <th class="col-qty">Quantity</th>
            <th class="col-unit">Unit Price</th>
            <th class="col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {{#each items}}
          <tr>
            <td>
              <div class="beam-product-cell">
                <div class="beam-thumb">
                  {{#if image}}
                    <img src="{{image}}" alt="" />
                  {{else}}
                    <div class="beam-thumb-empty" aria-hidden="true"></div>
                  {{/if}}
                </div>
                <div>
                  <div class="beam-product-name">{{name}}</div>
                  {{#if variation_text}}<div class="beam-variation">{{variation_text}}</div>{{/if}}
                </div>
              </div>
            </td>
            <td class="beam-sku">{{#ifFilled sku}}{{sku}}{{else}}—{{/ifFilled}}</td>
            <td class="beam-qty">{{quantity}}</td>
            <td class="beam-unit">
              {{#if (gt quantity 0)}}
                {{#if (gt subtotal total)}}
                  <div class="beam-price-compare">
                    <span class="beam-price-old">{{currency (divide subtotal quantity) ../order.currency}}</span>
                    <span class="beam-price-new">{{currency (divide total quantity) ../order.currency}}</span>
                  </div>
                {{else}}
                  {{currency (divide total quantity) ../order.currency}}
                {{/if}}
              {{else}}
                {{currency total ../order.currency}}
              {{/if}}
            </td>
            <td class="beam-total">
              {{#if (gt subtotal total)}}
                <div class="beam-price-compare">
                  <span class="beam-price-old">{{currency subtotal ../order.currency}}</span>
                  <span class="beam-price-new">{{currency total ../order.currency}}</span>
                </div>
              {{else}}
                {{currency total ../order.currency}}
              {{/if}}
            </td>
          </tr>
          {{/each}}
        </tbody>
      </table>

      <div class="beam-settlement-grid">
        <div class="beam-cell-note">
          <div class="beam-note">Thank you for your order. We appreciate your business.</div>
        </div>
        <div class="beam-cell-total-rows">
          <div class="beam-totals">
            <div class="beam-total-row"><span class="beam-lbl">Subtotal</span><span class="beam-val">{{currency totals.subtotal order.currency}}</span></div>
            {{#if (gt totals.discount 0)}}
            <div class="beam-total-row"><span class="beam-lbl">Discount</span><span class="beam-val">−{{currency totals.discount order.currency}}</span></div>
            {{/if}}
            <div class="beam-total-row">
              <span class="beam-lbl">Shipping</span>
              <span class="beam-val beam-ship-val">
                {{currency totals.shipping order.currency}}
                {{#if shipping_method.name}}<small>via {{shipping_method.name}}</small>{{/if}}
              </span>
            </div>
            {{#if (gt totals.tax 0)}}
            <div class="beam-total-row"><span class="beam-lbl">Tax</span><span class="beam-val">{{currency totals.tax order.currency}}</span></div>
            {{/if}}
          </div>
        </div>
        <div class="beam-cell-payment">
          {{#ifFilled payment.title}}
          <div class="beam-payment-foot"><strong>Payment Method:</strong> {{payment.title}}</div>
          {{/ifFilled}}
        </div>
        <div class="beam-cell-grand">
          <div class="beam-totals">
            <div class="beam-grand"><span>Total</span><span>{{currency totals.total order.currency}}</span></div>
          </div>
        </div>
      </div>
    </div>

    <footer class="beam-footer">
      <div class="beam-footer-links">
        {{#if store.terms_url}}
          <a href="{{store.terms_url}}" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</a>
          <span class="beam-footer-muted"> | </span>
          <a href="{{store.privacy_url}}" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        {{else}}
          <span class="beam-footer-muted">Terms &amp; Conditions | Privacy Policy</span>
        {{/if}}
      </div>
      <div class="beam-generated">Generated {{meta.printed_at}}</div>
    </footer>
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