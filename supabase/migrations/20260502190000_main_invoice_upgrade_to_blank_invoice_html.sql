-- Replace the legacy stub HTML for the platform "Main Invoice" sample template
-- with the rich blankInvoiceHtml() body shipped in src/lib/templates/document.ts.
-- The earlier migration `20260501120000_main_invoice_publish_and_default.sql`
-- inserted a minimal stub (~1k chars) which renders as a bare-bones invoice
-- and is detected by templateService.normalizeInvoiceSampleDocument as a
-- "legacy stub". This migration upgrades the published version document so
-- direct renders of the platform sample also use the rich layout.

DO $$
DECLARE
  tpl_id uuid;
  ver_id uuid;
  rich_html text := $body$<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Invoice {{order.invoice_number}}</title>
<style>
  @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
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
  .inv-pay-note strong {
    font-weight: 700;
    color: #111827;
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
        {{#ifFilled billing.name}}<dt>Name</dt><dd>{{billing.name}}</dd>{{/ifFilled}}
        {{#ifFilled billing.country}}<dt>Country</dt><dd>{{billing.country}}</dd>{{/ifFilled}}
        {{#ifFilled billing.city}}<dt>Area</dt><dd>{{billing.city}}</dd>{{/ifFilled}}
        {{#ifFilled billing.address.line1}}<dt>Street</dt><dd>{{billing.address.line1}}</dd>{{/ifFilled}}
        {{#ifFilled billing.address.line2}}<dt>Block</dt><dd>{{billing.address.line2}}</dd>{{/ifFilled}}
        {{#ifFilled billing.company}}<dt>Apartment</dt><dd>{{billing.company}}</dd>{{/ifFilled}}
        {{#ifFilled billing.phone}}<dt>Phone</dt><dd>{{billing.phone}}</dd>{{/ifFilled}}
        {{#ifFilled billing.email}}<dt>Email</dt><dd>{{billing.email}}</dd>{{/ifFilled}}
      </dl>
    </div>
    <div class="inv-meta">
      <dl class="inv-dl">
        {{#ifFilled order.invoice_number}}<dt>Invoice Number</dt><dd>{{order.invoice_number}}</dd>{{/ifFilled}}
        {{#ifFilled order.date_iso}}<dt>Invoice Date</dt><dd>{{date order.date_iso "long"}}</dd>{{/ifFilled}}
        {{#ifFilled order.woo_order_id}}<dt>Order Number</dt><dd>{{order.woo_order_id}}</dd>{{/ifFilled}}
        {{#ifFilled order.date_iso}}<dt>Order Date</dt><dd>{{date order.date_iso "long"}}</dd>{{/ifFilled}}
        {{#ifFilled payment.title}}<dt>Payment Method</dt><dd>{{payment.title}}</dd>{{/ifFilled}}
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
      {{#ifFilled payment.title}}
      <div class="inv-pay-note"><strong>Payment method:</strong> {{payment.title}}</div>
      {{/ifFilled}}
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
</html>$body$;
BEGIN
  SELECT t.id, t.current_version_id
    INTO tpl_id, ver_id
  FROM public.templates t
  WHERE t.is_sample = true
    AND t.type = 'invoice'
    AND lower(trim(t.name)) = lower('Main Invoice')
  LIMIT 1;

  IF tpl_id IS NULL THEN
    RETURN;
  END IF;

  IF ver_id IS NULL THEN
    INSERT INTO public.template_versions (template_id, version_number, document, styles)
    VALUES (tpl_id, 1, jsonb_build_object('html', rich_html), '{}'::jsonb)
    RETURNING id INTO ver_id;

    UPDATE public.templates
    SET current_version_id = ver_id, updated_at = now()
    WHERE id = tpl_id;
    RETURN;
  END IF;

  -- Replace the document.html on the published version (preserve other keys if any).
  UPDATE public.template_versions
  SET document = jsonb_set(
                   COALESCE(document, '{}'::jsonb) - 'grapesProject',
                   '{html}',
                   to_jsonb(rich_html),
                   true
                 )
  WHERE id = ver_id;

  UPDATE public.templates
  SET updated_at = now()
  WHERE id = tpl_id;
END $$;
