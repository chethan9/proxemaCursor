import type { Editor } from "grapesjs";
import {
  ELEMENT_CATEGORY,
  WOO_CATEGORY,
  LAYOUT_CATEGORY,
  REPORT_CATEGORY,
} from "@/lib/templates/templateBuilderPalette";

/* ---------- Icons (Lucide-style line set, 22px) ---------- */
const I = {
  text: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5h16v2"/><path d="M9 19h6"/><path d="M12 5v14"/></svg>`,
  image: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L9 20"/></svg>`,
  button: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="6" rx="3"/></svg>`,
  divider: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M5 6h4"/><path d="M5 18h14"/></svg>`,
  spacer: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8"/><path d="M8 20h8"/><path d="M12 4v16"/><path d="m9 8 3-3 3 3"/><path d="m9 16 3 3 3-3"/></svg>`,
  social: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="m8.6 13.5 6.8 3"/><path d="m15.4 7.5-6.8 3"/></svg>`,
  table: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 4v16"/></svg>`,
  columns: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="18" rx="1.5"/></svg>`,
  html: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m8 6-6 6 6 6"/><path d="m16 6 6 6-6 6"/><path d="m14 4-4 16"/></svg>`,
  receipt: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2H4Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>`,
  user: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-7 7-13a7 7 0 1 0-14 0c0 6 7 13 7 13Z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h11v10H2zM13 9h5l3 3v4h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`,
  package: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7 12 3l9 4v10l-9 4-9-4Z"/><path d="M3 7l9 4 9-4"/><path d="M12 11v10"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h12L22 7H6"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11V4h7l11 11-7 7Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`,
  percent: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>`,
  banknote: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v.01"/><path d="M18 14.5v.01"/></svg>`,
  card: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
  total: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>`,
  qr: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 17v4"/><path d="M14 20h3"/></svg>`,
  layoutSection: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/></svg>`,
  chartBar: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><rect x="6" y="11" width="3" height="8"/><rect x="11" y="6" width="3" height="13"/><rect x="16" y="14" width="3" height="5"/></svg>`,
};

const wrapMedia = (svg: string) => `<span class="tmpl-block-icon">${svg}</span>`;

/** Polished Handlebars-aware blocks for the PDF/email builder. */
export function registerTemplateBlocks(editor: Editor) {
  const bm = editor.BlockManager;

  /* ============= Basic (Elements tab) ============= */
  const basics: Array<{ id: string; label: string; icon: string; content: string }> = [
    {
      id: "elem-text",
      label: "Text",
      icon: I.text,
      content: '<p style="margin:0 0 10px;line-height:1.55;color:#334155;font-size:13px">Body text — double-click to edit.</p>',
    },
    {
      id: "elem-image",
      label: "Image",
      icon: I.image,
      content:
        '<div style="margin:8px 0"><img src="{{store.logo}}" alt="Logo" style="max-height:56px;max-width:180px;object-fit:contain;display:block" /></div>',
    },
    {
      id: "elem-button",
      label: "Button",
      icon: I.button,
      content:
        '<a href="#" style="display:inline-block;padding:10px 18px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600">Call to action</a>',
    },
    {
      id: "elem-divider",
      label: "Divider",
      icon: I.divider,
      content: '<hr style="border:0;border-top:1px solid #e2e8f0;margin:18px 0" />',
    },
    {
      id: "elem-spacer",
      label: "Spacer",
      icon: I.spacer,
      content: '<div style="height:28px" aria-hidden="true"></div>',
    },
    {
      id: "elem-social",
      label: "Social",
      icon: I.social,
      content: `<div style="display:flex;gap:14px;justify-content:center;margin:12px 0;color:#64748b;font-size:11px">
  <a href="{{store.socials.facebook}}" style="color:#64748b;text-decoration:none">Facebook</a>
  <a href="{{store.socials.instagram}}" style="color:#64748b;text-decoration:none">Instagram</a>
  <a href="{{store.socials.twitter}}" style="color:#64748b;text-decoration:none">Twitter</a>
  <a href="{{store.socials.youtube}}" style="color:#64748b;text-decoration:none">YouTube</a>
</div>`,
    },
    {
      id: "elem-table",
      label: "Table",
      icon: I.table,
      content: `<table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <tr style="background:#f8fafc"><th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0">Column A</th><th style="padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0">Column B</th></tr>
  <tr><td style="padding:8px 10px;border-bottom:1px solid #f1f5f9">Cell</td><td style="padding:8px 10px;border-bottom:1px solid #f1f5f9">Cell</td></tr>
</table>`,
    },
    {
      id: "elem-columns",
      label: "Columns",
      icon: I.columns,
      content: `<div style="display:flex;gap:20px;flex-wrap:wrap">
  <div style="flex:1;min-width:130px;padding:12px;background:#fff;border:1px dashed #cbd5e1;border-radius:10px">Column</div>
  <div style="flex:1;min-width:130px;padding:12px;background:#fff;border:1px dashed #cbd5e1;border-radius:10px">Column</div>
</div>`,
    },
    {
      id: "elem-html",
      label: "HTML",
      icon: I.html,
      content: `<div style="padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;font-family:ui-monospace,monospace;font-size:11px;color:#475569">&lt;!-- Raw HTML / Handlebars below --&gt;<div>{{customer.name}}</div></div>`,
    },
  ];

  for (const b of basics) {
    bm.add(b.id, {
      label: b.label,
      category: ELEMENT_CATEGORY,
      media: wrapMedia(b.icon),
      content: b.content,
    });
  }

  /* ============= WooCommerce (Blocks tab) ============= */
  const woo: Array<{ id: string; label: string; icon: string; content: string }> = [
    {
      id: "woo-order-details",
      label: "Order Details",
      icon: I.receipt,
      content: `<header style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:1px solid #e2e8f0;margin-bottom:20px">
  <div>
    <img src="{{store.logo}}" alt="" style="max-height:32px;display:block;margin-bottom:6px" />
    <div style="font-size:18px;font-weight:700;color:#0f172a">{{store.name}}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:14px;color:#0f172a">Invoice #{{order.number}}</div>
    <div style="font-size:12px;color:#64748b;margin-top:2px">{{date order.date_iso "short"}}</div>
  </div>
</header>`,
    },
    {
      id: "woo-customer-info",
      label: "Customer Info",
      icon: I.user,
      content: `<div style="margin:14px 0">
  <div style="font-size:18px;font-weight:700;color:#0f172a">Thanks for your order, {{customer.first_name}}!</div>
  <p style="margin:6px 0 0;color:#475569;font-size:13px">We've received your order and it is now being processed.</p>
</div>`,
    },
    {
      id: "woo-billing-address",
      label: "Billing Address",
      icon: I.pin,
      content: `<div style="font-size:12px;line-height:1.55;color:#334155">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700;margin-bottom:6px">Billing address</div>
  <div style="font-weight:600;color:#0f172a">{{billing.first_name}} {{billing.last_name}}</div>
  <div>{{billing.address_1}}</div>
  {{#if billing.address_2}}<div>{{billing.address_2}}</div>{{/if}}
  <div>{{billing.city}}, {{billing.state}} {{billing.postcode}}</div>
  <div>{{billing.country}}</div>
</div>`,
    },
    {
      id: "woo-shipping-address",
      label: "Shipping Address",
      icon: I.truck,
      content: `<div style="font-size:12px;line-height:1.55;color:#334155">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700;margin-bottom:6px">Shipping address</div>
  <div style="font-weight:600;color:#0f172a">{{shipping.first_name}} {{shipping.last_name}}</div>
  <div>{{shipping.address_1}}</div>
  {{#if shipping.address_2}}<div>{{shipping.address_2}}</div>{{/if}}
  <div>{{shipping.city}}, {{shipping.state}} {{shipping.postcode}}</div>
  <div>{{shipping.country}}</div>
</div>`,
    },
    {
      id: "woo-order-items",
      label: "Order Items",
      icon: I.package,
      content: `<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:12px">
  <thead>
    <tr style="border-bottom:1px solid #e2e8f0">
      <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600">Product</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600">Qty</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600">Price</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600">Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:12px;color:#0f172a">
        <div style="font-weight:600">{{name}}</div>
        {{#if sku}}<div style="font-family:ui-monospace,monospace;font-size:10px;color:#64748b;margin-top:2px">{{sku}}</div>{{/if}}
      </td>
      <td style="padding:12px;text-align:right">{{quantity}}</td>
      <td style="padding:12px;text-align:right">{{currency price ../order.currency}}</td>
      <td style="padding:12px;text-align:right">{{currency total ../order.currency}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>`,
    },
    {
      id: "woo-product-table",
      label: "Product Table",
      icon: I.cart,
      content: `<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:12px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
  <thead>
    <tr style="background:#f8fafc">
      <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;width:64px"></th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600">Product</th>
      <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600">SKU</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600">Qty</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600">Total</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr style="border-top:1px solid #e2e8f0">
      <td style="padding:10px 12px">{{#if image}}<img src="{{image}}" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px" />{{/if}}</td>
      <td style="padding:10px 12px;font-weight:600;color:#0f172a">{{name}}</td>
      <td style="padding:10px 12px;color:#64748b;font-family:ui-monospace,monospace;font-size:11px">{{sku}}</td>
      <td style="padding:10px 12px;text-align:right">{{quantity}}</td>
      <td style="padding:10px 12px;text-align:right;font-weight:600">{{currency total ../order.currency}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>`,
    },
    {
      id: "woo-subtotal",
      label: "Subtotal",
      icon: I.tag,
      content: `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#475569"><span>Subtotal</span><span>{{currency totals.subtotal order.currency}}</span></div>`,
    },
    {
      id: "woo-shipping",
      label: "Shipping",
      icon: I.truck,
      content: `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#475569"><span>Shipping</span><span>{{currency totals.shipping order.currency}}</span></div>`,
    },
    {
      id: "woo-tax",
      label: "Tax",
      icon: I.percent,
      content: `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#475569"><span>Tax</span><span>{{currency totals.tax order.currency}}</span></div>`,
    },
    {
      id: "woo-discount",
      label: "Discount",
      icon: I.tag,
      content: `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#475569"><span>Discount</span><span>-{{currency totals.discount order.currency}}</span></div>`,
    },
    {
      id: "woo-total",
      label: "Total",
      icon: I.total,
      content: `<div style="display:flex;justify-content:space-between;padding:10px 0;font-size:14px;color:#0f172a;border-top:2px solid #0f172a;font-weight:700;text-transform:uppercase;letter-spacing:1px"><span>Total</span><span>{{currency totals.total order.currency}}</span></div>`,
    },
    {
      id: "woo-payment-method",
      label: "Payment Method",
      icon: I.card,
      content: `<p style="margin:10px 0;font-size:12px;color:#64748b"><strong style="color:#0f172a">Paid by:</strong> {{payment.title}} · {{payment.status}}</p>`,
    },
  ];

  for (const b of woo) {
    bm.add(b.id, {
      label: b.label,
      category: WOO_CATEGORY,
      media: wrapMedia(b.icon),
      content: b.content,
    });
  }

  /* ============= Layout helpers ============= */
  bm.add("layout-section", {
    label: "Section",
    category: LAYOUT_CATEGORY,
    media: wrapMedia(I.layoutSection),
    content:
      '<section style="padding:18px;margin-bottom:14px;border:1px solid #e2e8f0;border-radius:10px;background:#fafafa"><p style="margin:0;color:#64748b;font-size:11px">Section — drag blocks here</p></section>',
  });

  bm.add("layout-2col", {
    label: "Two columns",
    category: LAYOUT_CATEGORY,
    media: wrapMedia(I.columns),
    content: `<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
  <div style="flex:1;min-width:140px;padding:14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px">Left column</div>
  <div style="flex:1;min-width:140px;padding:14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px">Right column</div>
</div>`,
  });

  bm.add("layout-qr", {
    label: "QR / Barcode",
    category: LAYOUT_CATEGORY,
    media: wrapMedia(I.qr),
    content: `<div style="display:flex;gap:18px;align-items:center;padding:14px;border:1px dashed #cbd5e1;border-radius:10px;background:#fafafa">
  <div>{{qrcode order.number size=92}}</div>
  <div style="font-size:11px;color:#475569">Scan to view order online: <strong style="color:#0f172a">#{{order.number}}</strong></div>
</div>`,
  });

  /* ============= Reports ============= */
  bm.add("report-header", {
    label: "Report header",
    category: REPORT_CATEGORY,
    media: wrapMedia(I.chartBar),
    content: `<header style="margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #0f172a">
  <div style="font-size:18px;font-weight:700;color:#0f172a">{{report.title}}</div>
  <div style="font-size:11px;color:#64748b;margin-top:6px">{{report.period_label}} · {{report.generated_at}}</div>
</header>`,
  });

  bm.add("report-kpis", {
    label: "KPI cards",
    category: REPORT_CATEGORY,
    media: wrapMedia(I.chartBar),
    content: `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px">
  <div style="flex:1;min-width:140px;padding:14px;border-radius:10px;border:1px solid #e2e8f0;background:#fff">
    <div style="font-size:10px;text-transform:uppercase;color:#64748b">Orders</div>
    <div style="font-size:20px;font-weight:700;color:#0f172a">{{summary.order_count}}</div>
  </div>
  <div style="flex:1;min-width:140px;padding:14px;border-radius:10px;border:1px solid #e2e8f0;background:#fff">
    <div style="font-size:10px;text-transform:uppercase;color:#64748b">Revenue</div>
    <div style="font-size:20px;font-weight:700;color:#0f172a">{{currency summary.revenue report.currency}}</div>
  </div>
</div>`,
  });

  bm.add("report-table", {
    label: "Report table",
    category: REPORT_CATEGORY,
    media: wrapMedia(I.table),
    content: `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:14px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <thead><tr style="background:#0f172a;color:#fff"><th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase">Order</th><th style="padding:10px 12px;font-size:10px;text-transform:uppercase">Date</th><th style="padding:10px 12px;text-align:right;font-size:10px;text-transform:uppercase">Total</th></tr></thead>
  <tbody>
    {{#each rows}}
    <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px 12px">{{order_number}}</td><td style="padding:10px 12px;color:#475569">{{date}}</td><td style="padding:10px 12px;text-align:right">{{currency total ../report.currency}}</td></tr>
    {{/each}}
  </tbody>
</table>`,
  });
}
