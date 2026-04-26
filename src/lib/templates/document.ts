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
  @page { size: A4; margin: 15mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1e293b; font-size: 13px; line-height: 1.5; margin: 0; }
  h1 { font-size: 28px; font-weight: 700; margin: 0 0 4px 0; letter-spacing: -0.5px; }
  .meta { color: #64748b; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #e2e8f0; }
  .addresses { display: flex; gap: 32px; margin-bottom: 24px; }
  .address-block { flex: 1; }
  .address-block h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin: 0 0 8px 0; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { text-align: left; padding: 10px 8px; background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
  td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; }
  .right { text-align: right; }
  .totals { margin-left: auto; width: 280px; }
  .totals td { padding: 6px 8px; border: none; }
  .totals .total-row td { border-top: 2px solid #1e293b; font-weight: 700; font-size: 15px; padding-top: 10px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>{{store.name}}</h1>
      <div class="meta">{{store.address}}</div>
      <div class="meta">{{store.email}} · {{store.phone}}</div>
    </div>
    <div class="right">
      <div style="font-size:14px;font-weight:600;letter-spacing:1px;color:#64748b;margin-bottom:4px">INVOICE</div>
      <div style="font-size:18px;font-weight:700">#{{order.number}}</div>
      <div class="meta">{{order.date}}</div>
    </div>
  </div>

  <div class="addresses">
    <div class="address-block">
      <h3>Bill To</h3>
      {{address billing}}
    </div>
    <div class="address-block">
      <h3>Ship To</h3>
      {{address shipping}}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>SKU</th>
        <th class="right">Qty</th>
        <th class="right">Price</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td><strong>{{name}}</strong></td>
        <td style="color:#64748b;font-family:monospace;font-size:11px">{{sku}}</td>
        <td class="right">{{qty}}</td>
        <td class="right">{{currency price ../order.currency}}</td>
        <td class="right">{{currency total ../order.currency}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td class="right">{{currency order.subtotal order.currency}}</td></tr>
    {{#if (gt order.shipping_total 0)}}<tr><td>Shipping</td><td class="right">{{currency order.shipping_total order.currency}}</td></tr>{{/if}}
    {{#if (gt order.tax_total 0)}}<tr><td>Tax</td><td class="right">{{currency order.tax_total order.currency}}</td></tr>{{/if}}
    {{#if (gt order.discount_total 0)}}<tr><td>Discount</td><td class="right">-{{currency order.discount_total order.currency}}</td></tr>{{/if}}
    <tr class="total-row"><td>Total</td><td class="right">{{currency order.total order.currency}}</td></tr>
  </table>

  <div class="footer">
    Thank you for your order. Generated {{meta.printed_at}}.
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