-- Sync platform "Main Invoice" sample HTML with blankInvoiceHtml() BEAM layout (document.ts).

UPDATE public.template_versions v
SET document = jsonb_set(COALESCE(v.document::jsonb, '{}'::jsonb), '{html}', to_jsonb($invbeam$
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice {{order.invoice_number}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
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
  @page { size: A4; margin: 14mm 14mm 14mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: 100%; }
  body {
    min-height: 100vh;
    margin: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: var(--ink);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .beam-outer {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 16px;
    width: 100%;
    box-sizing: border-box;
  }
  .beam-card {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 820px;
    min-height: calc(100vh - 64px);
    background: var(--paper);
    padding: 48px 56px;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(15, 23, 41, 0.04), 0 8px 24px -8px rgba(15, 23, 41, 0.08);
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
    align-items: flex-start;
    margin-bottom: 28px;
    gap: 16px;
  }
  .beam-brand { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
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
  }
  .beam-store-fallback {
    font-weight: 700;
    font-size: 18px;
    letter-spacing: -0.02em;
    color: var(--ink);
    line-height: 1.2;
  }
  .beam-header-right {
    text-align: right;
    font-size: 16px;
    font-weight: 600;
    color: var(--ink);
    flex-shrink: 0;
  }
  .beam-header-right .beam-email {
    font-size: 13px;
    font-weight: 400;
    color: var(--ink-soft);
    margin-top: 4px;
  }
  .beam-title {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 28px;
    text-transform: uppercase;
    color: var(--ink);
  }
  .beam-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 28px 32px;
    margin-bottom: 28px;
  }
  .beam-section-head {
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 14px;
    color: var(--ink);
  }
  .beam-info { margin-bottom: 12px; }
  .beam-info:last-child { margin-bottom: 0; }
  .beam-info-label {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 2px;
    color: var(--ink);
  }
  .beam-info-value {
    font-size: 13px;
    color: var(--ink-soft);
  }
  table.beam-items {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 20px;
    table-layout: fixed;
  }
  table.beam-items thead { display: table-header-group; }
  table.beam-items thead th {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--ink-mute);
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
    text-align: left;
  }
  table.beam-items thead th.col-qty { text-align: center; width: 88px; }
  table.beam-items thead th.col-price { text-align: right; width: 120px; }
  table.beam-items tbody td {
    padding: 12px 0;
    border-bottom: 1px solid var(--line-soft);
    vertical-align: middle;
    font-size: 14px;
  }
  table.beam-items tbody tr { page-break-inside: avoid; }
  .beam-product-cell {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .beam-thumb {
    width: 44px;
    height: 52px;
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
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 2px;
    color: var(--ink);
    word-break: break-word;
  }
  .beam-variation {
    font-size: 11px;
    color: var(--ink-mute);
  }
  .beam-qty {
    text-align: center;
    font-size: 14px;
    color: var(--ink-soft);
  }
  .beam-price {
    text-align: right;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    color: var(--ink);
  }
  .beam-totals-wrap {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
    page-break-inside: avoid;
  }
  .beam-totals {
    width: 100%;
    max-width: 280px;
  }
  .beam-total-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 13px;
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
    padding-top: 10px;
    margin-top: 6px;
    border-top: 1px solid var(--ink);
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
  }
  .beam-footer {
    margin-top: auto;
    flex-shrink: 0;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    text-align: right;
    font-size: 12px;
    color: var(--ink-soft);
    page-break-inside: avoid;
  }
  .beam-footer-pay strong { font-weight: 600; color: var(--ink); }
  .beam-footer-links {
    margin-top: 12px;
    text-align: center;
    font-size: 11px;
  }
  .beam-footer-links a {
    color: #2563eb;
    text-decoration: none;
  }
  .beam-footer-muted { color: var(--ink-mute); }
  .beam-generated {
    margin-top: 10px;
    font-size: 10px;
    color: var(--ink-mute);
    text-align: center;
  }
  @media print {
    body { background: #fff !important; padding: 0; }
    .beam-outer { padding: 0; }
    .beam-card {
      box-shadow: none;
      border-radius: 0;
      min-height: auto;
      max-width: none;
      padding: 0;
    }
  }
  @media (max-width: 640px) {
    .beam-card { padding: 24px 20px; min-height: auto; }
    .beam-details { grid-template-columns: 1fr; gap: 20px; }
    .beam-title { font-size: 26px; }
    .beam-totals { max-width: 100%; }
    .beam-thumb { width: 38px; height: 44px; }
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
          {{#if store.logo}}
            <img class="beam-logo" src="{{store.logo}}" alt="{{store.name}}" />
          {{else}}
            <div class="beam-store-fallback">{{store.name}}</div>
          {{/if}}
        </div>
        <div class="beam-header-right">
          <div>{{store.name}}</div>
          {{#if store.email}}<div class="beam-email">{{store.email}}</div>{{/if}}
        </div>
      </header>

      <h1 class="beam-title">Invoice</h1>

      <section class="beam-details">
        <div>
          <div class="beam-section-head">Billing Details</div>
          {{#ifFilled billing.name}}<div class="beam-info"><div class="beam-info-label">Name</div><div class="beam-info-value">{{billing.name}}</div></div>{{/ifFilled}}
          {{#ifFilled billing.country}}<div class="beam-info"><div class="beam-info-label">Country</div><div class="beam-info-value">{{billing.country}}</div></div>{{/ifFilled}}
          {{#ifFilled billing.city}}<div class="beam-info"><div class="beam-info-label">Area</div><div class="beam-info-value">{{billing.city}}</div></div>{{/ifFilled}}
          {{#ifFilled billing.address.line1}}<div class="beam-info"><div class="beam-info-label">Street</div><div class="beam-info-value">{{billing.address.line1}}</div></div>{{/ifFilled}}
          {{#ifFilled billing.address.line2}}<div class="beam-info"><div class="beam-info-label">Block</div><div class="beam-info-value">{{billing.address.line2}}</div></div>{{/ifFilled}}
          {{#ifFilled billing.company}}<div class="beam-info"><div class="beam-info-label">Apartment</div><div class="beam-info-value">{{billing.company}}</div></div>{{/ifFilled}}
          {{#ifFilled billing.phone}}<div class="beam-info"><div class="beam-info-label">Phone</div><div class="beam-info-value">{{billing.phone}}</div></div>{{/ifFilled}}
          {{#ifFilled billing.email}}<div class="beam-info"><div class="beam-info-label">Email</div><div class="beam-info-value">{{billing.email}}</div></div>{{/ifFilled}}
        </div>
        <div>
          {{#ifFilled order.invoice_number}}<div class="beam-info"><div class="beam-info-label">Invoice Number</div><div class="beam-info-value">{{order.invoice_number}}</div></div>{{/ifFilled}}
          {{#ifFilled order.date_iso}}<div class="beam-info"><div class="beam-info-label">Invoice Date</div><div class="beam-info-value">{{date order.date_iso "long"}}</div></div>{{/ifFilled}}
          {{#ifFilled order.woo_order_id}}<div class="beam-info"><div class="beam-info-label">Order Number</div><div class="beam-info-value">{{order.woo_order_id}}</div></div>{{/ifFilled}}
          {{#ifFilled order.date_iso}}<div class="beam-info"><div class="beam-info-label">Order Date</div><div class="beam-info-value">{{date order.date_iso "long"}}</div></div>{{/ifFilled}}
          {{#ifFilled payment.title}}<div class="beam-info"><div class="beam-info-label">Payment Method</div><div class="beam-info-value">{{payment.title}}</div></div>{{/ifFilled}}
        </div>
      </section>

      <table class="beam-items">
        <thead>
          <tr>
            <th>Product</th>
            <th class="col-qty">Quantity</th>
            <th class="col-price">Price</th>
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
            <td class="beam-qty">{{quantity}}</td>
            <td class="beam-price">{{currency total ../order.currency}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>

      <div class="beam-totals-wrap">
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
          <div class="beam-grand"><span>Total</span><span>{{currency totals.total order.currency}}</span></div>
        </div>
      </div>
    </div>

    <footer class="beam-footer">
      {{#ifFilled payment.title}}
      <div class="beam-footer-pay"><strong>Payment method:</strong> {{payment.title}}</div>
      {{/ifFilled}}
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
</html>$invbeam$::text))
FROM public.templates t
WHERE v.template_id = t.id
  AND t.is_sample = true
  AND t.type = 'invoice'
  AND lower(trim(t.name)) = lower('Main Invoice')
  AND t.current_version_id IS NOT NULL
  AND v.id = t.current_version_id;
