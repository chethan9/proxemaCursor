export type TemplateType = "invoice" | "pickslip";

export interface TemplateConfig {
  html: string;
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
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.5; margin: 0; background: #fff; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 18px; border-bottom: 3px solid #0f172a; margin-bottom: 24px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { max-height: 48px; max-width: 140px; object-fit: contain; }
  .brand-name { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
  .invoice-meta { text-align: right; }
  .invoice-meta .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; font-weight: 600; }
  .invoice-meta .number { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  .invoice-meta .date { font-size: 11px; color: #64748b; margin-top: 4px; }
  .status-pill { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; background: #dcfce7; color: #166534; }

  .store-info { font-size: 11px; color: #64748b; line-height: 1.6; margin-top: 6px; }
  .store-info div { margin: 0; }

  .addresses { display: flex; gap: 24px; margin-bottom: 24px; }
  .address-card { flex: 1; padding: 14px 16px; background: #f8fafc; border-radius: 6px; border-left: 3px solid #0f172a; }
  .address-card h3 { margin: 0 0 8px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 1.2px; color: #64748b; font-weight: 700; }
  .address-card .name { font-weight: 600; color: #0f172a; margin-bottom: 4px; }
  .address-card .line { color: #475569; font-size: 11px; }

  table.items { width: 100%; border-collapse: collapse; margin: 0 0 16px 0; }
  table.items thead th { text-align: left; padding: 10px 12px; background: #0f172a; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
  table.items thead th.right { text-align: right; }
  table.items tbody td { padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  table.items tbody tr:last-child td { border-bottom: 2px solid #0f172a; }
  table.items td.right { text-align: right; }
  table.items .item-name { font-weight: 600; color: #0f172a; }
  table.items .item-sku { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 10px; color: #64748b; margin-top: 2px; }
  table.items .item-variation { font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic; }
  table.items .item-image { width: 44px; height: 44px; border-radius: 4px; object-fit: cover; border: 1px solid #e2e8f0; }

  .summary-row { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
  .notes { flex: 1; padding: 14px 16px; background: #fffbeb; border-radius: 6px; border-left: 3px solid #f59e0b; font-size: 11px; color: #78350f; }
  .notes h4 { margin: 0 0 6px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #92400e; font-weight: 700; }
  .totals { width: 280px; }
  .totals table { width: 100%; border-collapse: collapse; }
  .totals td { padding: 6px 4px; font-size: 12px; }
  .totals td.right { text-align: right; }
  .totals .subtotal-label { color: #64748b; }
  .totals .grand { border-top: 2px solid #0f172a; padding-top: 10px; font-size: 15px; font-weight: 700; color: #0f172a; }

  .payment-block { display: flex; gap: 16px; padding: 14px 16px; background: #f1f5f9; border-radius: 6px; margin-bottom: 20px; font-size: 11px; }
  .payment-block .pay-col { flex: 1; }
  .payment-block .pay-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 600; margin-bottom: 3px; }
  .payment-block .pay-value { color: #0f172a; font-weight: 500; }

  .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
  .footer .thanks { font-size: 11px; color: #64748b; line-height: 1.6; }
  .footer .thanks .big { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 4px; }
  .footer .barcode { text-align: right; }
  .footer .barcode-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-top: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">
      {{#if store.logo}}<img src="{{store.logo}}" alt="{{store.name}}" />{{/if}}
      <div>
        <div class="brand-name">{{store.name}}</div>
        <div class="store-info">
          {{#if store.address.line1}}<div>{{store.address.line1}}{{#if store.address.line2}}, {{store.address.line2}}{{/if}}</div>{{/if}}
          {{#if store.address.city}}<div>{{store.address.city}}{{#if store.address.state}}, {{store.address.state}}{{/if}} {{store.address.zip}}</div>{{/if}}
          {{#if store.address.country}}<div>{{store.address.country}}</div>{{/if}}
          <div>{{#if store.email}}{{store.email}}{{/if}}{{#if store.phone}} · {{store.phone}}{{/if}}</div>
        </div>
      </div>
    </div>
    <div class="invoice-meta">
      <div class="label">Invoice</div>
      <div class="number">#{{order.number}}</div>
      <div class="date">{{date order.date_iso "short"}}</div>
      <span class="status-pill">{{uppercase order.status}}</span>
    </div>
  </div>

  <div class="addresses">
    <div class="address-card">
      <h3>Bill To</h3>
      <div class="name">{{billing.name}}</div>
      {{#if billing.company}}<div class="line">{{billing.company}}</div>{{/if}}
      {{#if billing.address.line1}}<div class="line">{{billing.address.line1}}</div>{{/if}}
      {{#if billing.address.line2}}<div class="line">{{billing.address.line2}}</div>{{/if}}
      <div class="line">{{billing.city}}{{#if billing.state}}, {{billing.state}}{{/if}} {{billing.zip}}</div>
      {{#if billing.country}}<div class="line">{{billing.country}}</div>{{/if}}
      {{#if billing.email}}<div class="line">{{billing.email}}</div>{{/if}}
      {{#if billing.phone}}<div class="line">{{billing.phone}}</div>{{/if}}
    </div>
    <div class="address-card">
      <h3>Ship To</h3>
      <div class="name">{{shipping.name}}</div>
      {{#if shipping.company}}<div class="line">{{shipping.company}}</div>{{/if}}
      {{#if shipping.address.line1}}<div class="line">{{shipping.address.line1}}</div>{{/if}}
      {{#if shipping.address.line2}}<div class="line">{{shipping.address.line2}}</div>{{/if}}
      <div class="line">{{shipping.city}}{{#if shipping.state}}, {{shipping.state}}{{/if}} {{shipping.zip}}</div>
      {{#if shipping.country}}<div class="line">{{shipping.country}}</div>{{/if}}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:60px"></th>
        <th>Item</th>
        <th class="right" style="width:60px">Qty</th>
        <th class="right" style="width:90px">Price</th>
        <th class="right" style="width:100px">Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td>{{#if image}}<img src="{{image}}" class="item-image" alt="{{name}}" />{{/if}}</td>
        <td>
          <div class="item-name">{{name}}</div>
          {{#if sku}}<div class="item-sku">{{sku}}</div>{{/if}}
          {{#if variation_text}}<div class="item-variation">{{variation_text}}</div>{{/if}}
        </td>
        <td class="right">{{quantity}}</td>
        <td class="right">{{currency price ../order.currency}}</td>
        <td class="right">{{currency total ../order.currency}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="summary-row">
    <div class="notes">
      {{#if order.notes}}
        <h4>Customer Note</h4>
        {{order.notes}}
      {{else}}
        <h4>Thank You</h4>
        We appreciate your business. If you have any questions about this invoice, please contact us.
      {{/if}}
    </div>
    <div class="totals">
      <table>
        <tr><td class="subtotal-label">Subtotal</td><td class="right">{{currency totals.subtotal order.currency}}</td></tr>
        {{#if (gt totals.shipping 0)}}<tr><td class="subtotal-label">Shipping</td><td class="right">{{currency totals.shipping order.currency}}</td></tr>{{/if}}
        {{#if (gt totals.tax 0)}}<tr><td class="subtotal-label">Tax</td><td class="right">{{currency totals.tax order.currency}}</td></tr>{{/if}}
        {{#if (gt totals.discount 0)}}<tr><td class="subtotal-label">Discount</td><td class="right">−{{currency totals.discount order.currency}}</td></tr>{{/if}}
        <tr class="grand"><td>Total</td><td class="right">{{currency totals.total order.currency}}</td></tr>
      </table>
    </div>
  </div>

  <div class="payment-block">
    <div class="pay-col">
      <div class="pay-label">Payment Method</div>
      <div class="pay-value">{{default payment.title "—"}}</div>
    </div>
    <div class="pay-col">
      <div class="pay-label">Payment Status</div>
      <div class="pay-value">{{capitalize (default payment.status order.status)}}</div>
    </div>
    {{#if payment.transaction_id}}
    <div class="pay-col">
      <div class="pay-label">Transaction ID</div>
      <div class="pay-value" style="font-family:ui-monospace,monospace;font-size:10px">{{payment.transaction_id}}</div>
    </div>
    {{/if}}
    {{#if shipping_method.tracking_number}}
    <div class="pay-col">
      <div class="pay-label">Tracking</div>
      <div class="pay-value">{{shipping_method.tracking_number}}</div>
    </div>
    {{/if}}
  </div>

  <div class="footer">
    <div class="thanks">
      <div class="big">Thank you for your purchase!</div>
      <div>{{#if store.website}}{{store.website}}{{else}}{{store.url}}{{/if}}{{#if store.email}} · {{store.email}}{{/if}}</div>
      <div style="margin-top:6px;font-size:10px;color:#94a3b8">Generated {{meta.printed_at}}</div>
    </div>
    <div class="barcode">
      {{barcode order.number height=12}}
      <div class="barcode-label">{{order.number}}</div>
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