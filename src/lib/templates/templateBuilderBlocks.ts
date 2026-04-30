import type { Editor } from "grapesjs";
import {
  ELEMENT_CATEGORY,
  SITE_CATEGORY,
  ORDER_CATEGORY,
  LAYOUT_CATEGORY,
  REPORT_CATEGORY,
  HELPERS_CATEGORY,
} from "@/lib/templates/templateBuilderPalette";

/* ---------- Icons (Lucide-style line set, 22px) ---------- */
const I = {
  text: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5h16v2"/><path d="M9 19h6"/><path d="M12 5v14"/></svg>`,
  heading: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 12h12"/></svg>`,
  image: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L9 20"/></svg>`,
  button: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="6" rx="3"/></svg>`,
  divider: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/><path d="M5 6h4"/><path d="M5 18h14"/></svg>`,
  spacer: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8"/><path d="M8 20h8"/><path d="M12 4v16"/><path d="m9 8 3-3 3 3"/><path d="m9 16 3 3 3-3"/></svg>`,
  social: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="m8.6 13.5 6.8 3"/><path d="m15.4 7.5-6.8 3"/></svg>`,
  table: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 4v16"/></svg>`,
  columns: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="18" rx="1.5"/></svg>`,
  cols3: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="18" rx="1.2"/><rect x="9.5" y="3" width="5" height="18" rx="1.2"/><rect x="16" y="3" width="5" height="18" rx="1.2"/></svg>`,
  html: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m8 6-6 6 6 6"/><path d="m16 6 6 6-6 6"/><path d="m14 4-4 16"/></svg>`,
  receipt: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2H4Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg>`,
  user: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-7 7-13a7 7 0 1 0-14 0c0 6 7 13 7 13Z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h11v10H2zM13 9h5l3 3v4h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`,
  package: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7 12 3l9 4v10l-9 4-9-4Z"/><path d="M3 7l9 4 9-4"/><path d="M12 11v10"/></svg>`,
  cart: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h12L22 7H6"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11V4h7l11 11-7 7Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>`,
  percent: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>`,
  card: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
  total: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>`,
  qr: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 17v4"/><path d="M14 20h3"/></svg>`,
  barcode: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v14"/><path d="M7 5v14"/><path d="M10 5v14"/><path d="M14 5v14"/><path d="M17 5v14"/><path d="M20 5v14"/></svg>`,
  layoutSection: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/></svg>`,
  pageBreak: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h10l6 6v10"/><path d="M14 4v6h6"/><path d="M4 16h16" stroke-dasharray="3 3"/></svg>`,
  chartBar: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><rect x="6" y="11" width="3" height="8"/><rect x="11" y="6" width="3" height="13"/><rect x="16" y="14" width="3" height="5"/></svg>`,
  store: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h16l-1.2 11.4a1 1 0 0 1-1 .9H6.2a1 1 0 0 1-1-.9L4 8Z"/><path d="M4 8 6 4h12l2 4"/><path d="M9 13h6"/></svg>`,
  badge: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6Z"/><path d="m9 12 2 2 4-4"/></svg>`,
  note: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5z"/><path d="M9 9h6"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.35-9.5-9.5C1 7.5 4 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3 0 6 3.5 4.5 7.5C19 16.65 12 21 12 21Z"/></svg>`,
  loop: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 4 21 8l-4 4"/><path d="M3 12V9a4 4 0 0 1 4-4h13"/><path d="M7 20 3 16l4-4"/><path d="M21 12v3a4 4 0 0 1-4 4H4"/></svg>`,
  branch: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="20" r="2"/><path d="M6 8v2a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4"/><path d="M6 8a4 4 0 0 0 4 4h4"/></svg>`,
};

const wrapMedia = (svg: string) => `<span class="tmpl-block-icon">${svg}</span>`;

type BlockDef = { id: string; label: string; icon: string; content: string };

/**
 * Polished blocks for the PDF/email builder.
 *
 * Block content uses **realistic dummy data** (not Handlebars) so the canvas
 * looks like a finished invoice while you design.  When you want a field to
 * be dynamic, replace the dummy text with a token from the Variables popup
 * — e.g. swap "Sarah Johnson" for `{{customer.name}}`.  At render time the
 * server-side Handlebars engine fills any tokens it finds with real data.
 */
export function registerTemplateBlocks(editor: Editor) {
  const bm = editor.BlockManager;

  /* Layout primitives — row is structural shell; columns accept drops */
  const dc = editor.DomComponents;
  dc.addType("tml-row", {
    extend: "default",
    isComponent: (el) => !!(el as HTMLElement).classList?.contains("tml-row"),
    model: {
      defaults: {
        tagName: "div",
        draggable: true,
        droppable: false,
        highlightable: true,
      },
    },
  });
  dc.addType("tml-col", {
    extend: "default",
    isComponent: (el) => !!(el as HTMLElement).classList?.contains("tml-col"),
    model: {
      defaults: {
        tagName: "div",
        draggable: true,
        droppable: true,
        highlightable: true,
      },
    },
  });

  /* ============= Elements (Basic) — atomic building blocks ============= */
  const basics: BlockDef[] = [
    {
      id: "elem-text",
      label: "Text",
      icon: I.text,
      content:
        '<p style="margin:0 0 10px;line-height:1.55;color:#334155;font-size:13px">Body text — double-click to edit.</p>',
    },
    {
      id: "elem-heading",
      label: "Heading",
      icon: I.heading,
      content:
        '<h2 style="margin:0 0 10px;font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.2px">Heading</h2>',
    },
    {
      id: "elem-image",
      label: "Image",
      icon: I.image,
      content:
        '<div style="margin:8px 0"><img src="https://placehold.co/240x80?text=Image" alt="" style="max-height:80px;max-width:240px;object-fit:contain;display:block" /></div>',
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
  <a href="#" style="color:#64748b;text-decoration:none">Facebook</a>
  <a href="#" style="color:#64748b;text-decoration:none">Instagram</a>
  <a href="#" style="color:#64748b;text-decoration:none">Twitter</a>
  <a href="#" style="color:#64748b;text-decoration:none">YouTube</a>
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
      content: `<div class="tml-row tml-row--top" data-gjs-droppable="false" style="display:flex;gap:16px;flex-wrap:wrap;width:100%;align-items:stretch;box-sizing:border-box;margin:0 0 12px 0">
  <div class="tml-col tml-col--6" data-gjs-droppable="true" data-gjs-highlightable="true" style="flex:1 1 calc(50% - 8px);max-width:calc(50% - 8px);min-width:0;box-sizing:border-box;border:1px dashed #cbd5e1;border-radius:10px;background:#fafafa;padding:12px;min-height:48px">Column A — drag blocks here</div>
  <div class="tml-col tml-col--6" data-gjs-droppable="true" data-gjs-highlightable="true" style="flex:1 1 calc(50% - 8px);max-width:calc(50% - 8px);min-width:0;box-sizing:border-box;border:1px dashed #cbd5e1;border-radius:10px;background:#fafafa;padding:12px;min-height:48px">Column B — drag blocks here</div>
</div>`,
    },
    {
      id: "elem-html",
      label: "HTML",
      icon: I.html,
      content: `<div style="padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;font-family:ui-monospace,monospace;font-size:11px;color:#475569">&lt;!-- Raw HTML — paste your custom markup here --&gt;</div>`,
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

  /* ============= Site (store-info blocks) ============= */
  const site: BlockDef[] = [
    {
      id: "site-header",
      label: "Site Header",
      icon: I.store,
      content: `<header style="display:flex;justify-content:space-between;align-items:center;padding:0 0 18px;border-bottom:2px solid #0f172a;margin-bottom:20px;gap:24px">
  <div style="display:flex;align-items:center;gap:14px">
    <img src="https://placehold.co/96x48?text=LOGO" alt="" style="max-height:48px;max-width:160px;object-fit:contain" />
    <div>
      <div style="font-size:18px;font-weight:700;color:#0f172a;letter-spacing:-0.2px">Acme Studio</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px">www.acmestudio.com</div>
    </div>
  </div>
  <div style="text-align:right;font-size:11px;color:#64748b;line-height:1.55">
    <div>1234 Market Street</div>
    <div>San Francisco, CA 94102</div>
    <div>hello@acmestudio.com</div>
    <div>+1 (415) 555-0142</div>
  </div>
</header>`,
    },
    {
      id: "site-footer",
      label: "Site Footer",
      icon: I.store,
      content: `<footer style="margin-top:32px;padding-top:18px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#64748b;line-height:1.6">
  <div style="font-weight:600;color:#0f172a">Acme Studio</div>
  <div>1234 Market Street, San Francisco, CA 94102</div>
  <div style="margin-top:6px">hello@acmestudio.com · +1 (415) 555-0142</div>
  <div style="margin-top:4px">www.acmestudio.com</div>
</footer>`,
    },
    {
      id: "site-store-info",
      label: "Store Info",
      icon: I.note,
      content: `<div style="padding:14px 16px;background:#f8fafc;border-radius:8px;border-left:3px solid #0f172a;font-size:12px;line-height:1.6;color:#475569">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#64748b;font-weight:700;margin-bottom:6px">Store</div>
  <div style="font-weight:600;color:#0f172a">Acme Studio</div>
  <div>1234 Market Street</div>
  <div>San Francisco, CA 94102</div>
  <div>USA</div>
  <div style="margin-top:6px;color:#0f172a">hello@acmestudio.com</div>
  <div>+1 (415) 555-0142</div>
</div>`,
    },
    {
      id: "site-logo",
      label: "Store Logo",
      icon: I.image,
      content:
        '<div style="margin:8px 0"><img src="https://placehold.co/200x64?text=ACME+STUDIO" alt="Acme Studio" style="max-height:64px;max-width:200px;object-fit:contain;display:block" /></div>',
    },
    {
      id: "site-contact",
      label: "Contact Info",
      icon: I.user,
      content: `<div style="font-size:12px;color:#475569;line-height:1.55">
  <div><strong style="color:#0f172a">Email:</strong> hello@acmestudio.com</div>
  <div><strong style="color:#0f172a">Phone:</strong> +1 (415) 555-0142</div>
  <div><strong style="color:#0f172a">Web:</strong> www.acmestudio.com</div>
</div>`,
    },
  ];

  for (const b of site) {
    bm.add(b.id, {
      label: b.label,
      category: SITE_CATEGORY,
      media: wrapMedia(b.icon),
      content: b.content,
    });
  }

  /* ============= Order (data-bound order/invoice blocks) ============= */
  const order: BlockDef[] = [
    {
      id: "order-details",
      label: "Order Details",
      icon: I.receipt,
      content: `<header style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:1px solid #e2e8f0;margin-bottom:20px">
  <div>
    <img src="https://placehold.co/96x32?text=LOGO" alt="" style="max-height:32px;display:block;margin-bottom:6px" />
    <div style="font-size:18px;font-weight:700;color:#0f172a">Acme Studio</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:#64748b;font-weight:600">Invoice</div>
    <div style="font-size:18px;font-weight:700;color:#0f172a">#INV-2026-1042</div>
    <div style="font-size:11px;color:#64748b;margin-top:2px">Apr 30, 2026</div>
  </div>
</header>`,
    },
    {
      id: "order-customer",
      label: "Customer Info",
      icon: I.user,
      content: `<div style="margin:14px 0">
  <div style="font-size:18px;font-weight:700;color:#0f172a">Thanks for your order, Sarah!</div>
  <p style="margin:6px 0 0;color:#475569;font-size:13px">We've received your order and it is now being processed.</p>
</div>`,
    },
    {
      id: "order-billing-address",
      label: "Billing Address",
      icon: I.pin,
      content: `<div style="font-size:12px;line-height:1.55;color:#334155">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700;margin-bottom:6px">Billing address</div>
  <div style="font-weight:600;color:#0f172a">Sarah Johnson</div>
  <div>456 Oak Avenue</div>
  <div>Apt 7B</div>
  <div>San Francisco, CA 94110</div>
  <div>USA</div>
</div>`,
    },
    {
      id: "order-shipping-address",
      label: "Shipping Address",
      icon: I.truck,
      content: `<div style="font-size:12px;line-height:1.55;color:#334155">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700;margin-bottom:6px">Shipping address</div>
  <div style="font-weight:600;color:#0f172a">Sarah Johnson</div>
  <div>456 Oak Avenue</div>
  <div>Apt 7B</div>
  <div>San Francisco, CA 94110</div>
  <div>USA</div>
</div>`,
    },
    {
      id: "order-items",
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
    <tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:12px;color:#0f172a">
        <div style="font-weight:600">Vintage Linen Blazer</div>
        <div style="font-family:ui-monospace,monospace;font-size:10px;color:#64748b;margin-top:2px">SKU-VLB-001</div>
        <div style="font-size:10px;color:#64748b;margin-top:2px;font-style:italic">Size: M, Color: Cream</div>
      </td>
      <td style="padding:12px;text-align:right">1</td>
      <td style="padding:12px;text-align:right">$189.00</td>
      <td style="padding:12px;text-align:right">$189.00</td>
    </tr>
    <tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:12px;color:#0f172a">
        <div style="font-weight:600">Leather Crossbody Bag</div>
        <div style="font-family:ui-monospace,monospace;font-size:10px;color:#64748b;margin-top:2px">SKU-LCB-007</div>
      </td>
      <td style="padding:12px;text-align:right">1</td>
      <td style="padding:12px;text-align:right">$129.99</td>
      <td style="padding:12px;text-align:right">$129.99</td>
    </tr>
    <tr style="border-bottom:1px solid #f1f5f9">
      <td style="padding:12px;color:#0f172a">
        <div style="font-weight:600">Silk Scarf — Hand Painted</div>
        <div style="font-family:ui-monospace,monospace;font-size:10px;color:#64748b;margin-top:2px">SKU-SSH-023</div>
      </td>
      <td style="padding:12px;text-align:right">2</td>
      <td style="padding:12px;text-align:right">$49.50</td>
      <td style="padding:12px;text-align:right">$99.00</td>
    </tr>
  </tbody>
</table>`,
    },
    {
      id: "order-product-table",
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
    <tr style="border-top:1px solid #e2e8f0">
      <td style="padding:10px 12px"><img src="https://placehold.co/44x44?text=IMG" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px" /></td>
      <td style="padding:10px 12px;font-weight:600;color:#0f172a">Vintage Linen Blazer<div style="font-size:10px;color:#64748b;font-weight:400;margin-top:2px;font-style:italic">Size: M, Color: Cream</div></td>
      <td style="padding:10px 12px;color:#64748b;font-family:ui-monospace,monospace;font-size:11px">SKU-VLB-001</td>
      <td style="padding:10px 12px;text-align:right">1</td>
      <td style="padding:10px 12px;text-align:right;font-weight:600">$189.00</td>
    </tr>
    <tr style="border-top:1px solid #e2e8f0">
      <td style="padding:10px 12px"><img src="https://placehold.co/44x44?text=IMG" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:6px" /></td>
      <td style="padding:10px 12px;font-weight:600;color:#0f172a">Leather Crossbody Bag</td>
      <td style="padding:10px 12px;color:#64748b;font-family:ui-monospace,monospace;font-size:11px">SKU-LCB-007</td>
      <td style="padding:10px 12px;text-align:right">1</td>
      <td style="padding:10px 12px;text-align:right;font-weight:600">$129.99</td>
    </tr>
  </tbody>
</table>`,
    },
    {
      id: "order-subtotal",
      label: "Subtotal",
      icon: I.tag,
      content: `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#475569"><span>Subtotal</span><span>$417.99</span></div>`,
    },
    {
      id: "order-shipping",
      label: "Shipping",
      icon: I.truck,
      content: `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#475569"><span>Shipping</span><span>$12.50</span></div>`,
    },
    {
      id: "order-tax",
      label: "Tax",
      icon: I.percent,
      content: `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#475569"><span>Tax</span><span>$35.20</span></div>`,
    },
    {
      id: "order-discount",
      label: "Discount",
      icon: I.tag,
      content: `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#475569"><span>Discount</span><span>-$25.00</span></div>`,
    },
    {
      id: "order-total",
      label: "Total",
      icon: I.total,
      content: `<div style="display:flex;justify-content:space-between;padding:10px 0;font-size:14px;color:#0f172a;border-top:2px solid #0f172a;font-weight:700;text-transform:uppercase;letter-spacing:1px"><span>Total</span><span>$440.69</span></div>`,
    },
    {
      id: "order-payment",
      label: "Payment Method",
      icon: I.card,
      content: `<p style="margin:10px 0;font-size:12px;color:#64748b"><strong style="color:#0f172a">Paid by:</strong> Visa •• 4242 · Captured</p>`,
    },
    {
      id: "order-notes",
      label: "Customer Notes",
      icon: I.note,
      content: `<div style="margin:14px 0;padding:14px 16px;background:#fffbeb;border-radius:6px;border-left:3px solid #f59e0b;font-size:12px;color:#78350f">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#92400e;font-weight:700;margin-bottom:6px">Customer note</div>
  <div>Please leave the package at the front door — no need to ring the bell. Thank you!</div>
</div>`,
    },
    {
      id: "order-tracking",
      label: "Tracking",
      icon: I.truck,
      content: `<div style="margin:14px 0;padding:12px 14px;background:#f0fdf4;border-radius:6px;border-left:3px solid #16a34a;font-size:12px;color:#166534">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#15803d;font-weight:700;margin-bottom:4px">Shipping</div>
  <div><strong>FedEx Ground</strong> · 7776 1234 5678</div>
</div>`,
    },
    {
      id: "order-status-badge",
      label: "Status Badge",
      icon: I.badge,
      content: `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:10px;text-transform:uppercase;letter-spacing:0.6px;font-weight:600;background:#dcfce7;color:#166534">Paid</span>`,
    },
    {
      id: "order-thank-you",
      label: "Thank You",
      icon: I.heart,
      content: `<div style="text-align:center;margin:24px 0;padding:18px;border:1px dashed #cbd5e1;border-radius:10px;background:#fafafa">
  <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px">Thank you for shopping with Acme Studio!</div>
  <div style="font-size:11px;color:#64748b">Questions? Reach us at hello@acmestudio.com or +1 (415) 555-0142.</div>
</div>`,
    },
  ];

  for (const b of order) {
    bm.add(b.id, {
      label: b.label,
      category: ORDER_CATEGORY,
      media: wrapMedia(b.icon),
      content: b.content,
    });
  }

  /* ============= Layout ============= */
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
    content: `<div class="tml-row tml-row--top tml-row--loose" data-gjs-droppable="false" style="display:flex;gap:24px;flex-wrap:wrap;width:100%;align-items:stretch;box-sizing:border-box;margin:0 0 14px 0">
  <div class="tml-col tml-col--6" data-gjs-droppable="true" data-gjs-highlightable="true" style="flex:1 1 calc(50% - 12px);max-width:calc(50% - 12px);min-width:0;box-sizing:border-box;padding:14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;min-height:56px">Left — drag blocks here</div>
  <div class="tml-col tml-col--6" data-gjs-droppable="true" data-gjs-highlightable="true" style="flex:1 1 calc(50% - 12px);max-width:calc(50% - 12px);min-width:0;box-sizing:border-box;padding:14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;min-height:56px">Right — drag blocks here</div>
</div>`,
  });

  bm.add("layout-3col", {
    label: "Three columns",
    category: LAYOUT_CATEGORY,
    media: wrapMedia(I.cols3),
    content: `<div class="tml-row tml-row--top" data-gjs-droppable="false" style="display:flex;gap:16px;flex-wrap:wrap;width:100%;align-items:stretch;box-sizing:border-box;margin:0 0 14px 0">
  <div class="tml-col tml-col--4" data-gjs-droppable="true" data-gjs-highlightable="true" style="flex:1 1 calc(33.333% - 11px);max-width:calc(33.333% - 11px);min-width:0;box-sizing:border-box;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;min-height:56px">Column 1</div>
  <div class="tml-col tml-col--4" data-gjs-droppable="true" data-gjs-highlightable="true" style="flex:1 1 calc(33.333% - 11px);max-width:calc(33.333% - 11px);min-width:0;box-sizing:border-box;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;min-height:56px">Column 2</div>
  <div class="tml-col tml-col--4" data-gjs-droppable="true" data-gjs-highlightable="true" style="flex:1 1 calc(33.333% - 11px);max-width:calc(33.333% - 11px);min-width:0;box-sizing:border-box;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;min-height:56px">Column 3</div>
</div>`,
  });

  bm.add("layout-page-break", {
    label: "Page Break",
    category: LAYOUT_CATEGORY,
    media: wrapMedia(I.pageBreak),
    content:
      '<div style="page-break-after:always;break-after:page;height:0;border-top:1px dashed #cbd5e1;margin:18px 0" data-tmpl-page-break="true" aria-hidden="true"></div>',
  });

  /* ============= Reports ============= */
  bm.add("report-header", {
    label: "Report header",
    category: REPORT_CATEGORY,
    media: wrapMedia(I.chartBar),
    content: `<header style="margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #0f172a">
  <div style="font-size:18px;font-weight:700;color:#0f172a">Monthly Sales Report</div>
  <div style="font-size:11px;color:#64748b;margin-top:6px">April 2026 · Generated Apr 30, 2026 10:00 UTC</div>
</header>`,
  });

  bm.add("report-kpis", {
    label: "KPI cards",
    category: REPORT_CATEGORY,
    media: wrapMedia(I.chartBar),
    content: `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px">
  <div style="flex:1;min-width:140px;padding:14px;border-radius:10px;border:1px solid #e2e8f0;background:#fff">
    <div style="font-size:10px;text-transform:uppercase;color:#64748b">Orders</div>
    <div style="font-size:20px;font-weight:700;color:#0f172a">142</div>
  </div>
  <div style="flex:1;min-width:140px;padding:14px;border-radius:10px;border:1px solid #e2e8f0;background:#fff">
    <div style="font-size:10px;text-transform:uppercase;color:#64748b">Revenue</div>
    <div style="font-size:20px;font-weight:700;color:#0f172a">$24,389.12</div>
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
    <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px 12px">#INV-2026-1042</td><td style="padding:10px 12px;color:#475569">Apr 30, 2026</td><td style="padding:10px 12px;text-align:right">$440.69</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px 12px">#INV-2026-1041</td><td style="padding:10px 12px;color:#475569">Apr 29, 2026</td><td style="padding:10px 12px;text-align:right">$185.00</td></tr>
    <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px 12px">#INV-2026-1040</td><td style="padding:10px 12px;color:#475569">Apr 29, 2026</td><td style="padding:10px 12px;text-align:right">$612.30</td></tr>
  </tbody>
</table>`,
  });

  /* ============= Handlebars helpers — visual placeholders ============= */
  bm.add("hb-barcode", {
    label: "Barcode",
    category: HELPERS_CATEGORY,
    media: wrapMedia(I.barcode),
    content: `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin:14px 0">
  <div style="display:flex;gap:2px;height:40px;align-items:stretch">
    <span style="background:#0f172a;width:2px"></span><span style="background:#0f172a;width:1px"></span><span style="background:#0f172a;width:3px"></span><span style="background:#0f172a;width:1px"></span><span style="background:#0f172a;width:2px"></span><span style="background:#0f172a;width:1px"></span><span style="background:#0f172a;width:1px"></span><span style="background:#0f172a;width:3px"></span><span style="background:#0f172a;width:1px"></span><span style="background:#0f172a;width:2px"></span><span style="background:#0f172a;width:2px"></span><span style="background:#0f172a;width:1px"></span><span style="background:#0f172a;width:3px"></span><span style="background:#0f172a;width:1px"></span><span style="background:#0f172a;width:2px"></span><span style="background:#0f172a;width:1px"></span><span style="background:#0f172a;width:1px"></span><span style="background:#0f172a;width:3px"></span><span style="background:#0f172a;width:1px"></span><span style="background:#0f172a;width:2px"></span><span style="background:#0f172a;width:2px"></span><span style="background:#0f172a;width:1px"></span><span style="background:#0f172a;width:3px"></span><span style="background:#0f172a;width:2px"></span><span style="background:#0f172a;width:1px"></span><span style="background:#0f172a;width:2px"></span>
  </div>
  <div style="font-family:ui-monospace,monospace;font-size:11px;color:#475569">#INV-2026-1042</div>
</div>`,
    },
  );

  bm.add("hb-qrcode", {
    label: "QR Code",
    category: HELPERS_CATEGORY,
    media: wrapMedia(I.qr),
    content: `<div style="display:flex;gap:18px;align-items:center;padding:14px;border:1px dashed #cbd5e1;border-radius:10px;background:#fafafa">
  <div style="width:92px;height:92px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;font-family:ui-monospace,monospace">QR · 92×92</div>
  <div style="font-size:11px;color:#475569">Scan to view order online: <strong style="color:#0f172a">#INV-2026-1042</strong></div>
</div>`,
  });

  bm.add("hb-items-loop", {
    label: "Items List",
    category: HELPERS_CATEGORY,
    media: wrapMedia(I.loop),
    content: `<div style="margin:14px 0">
  <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px">
    <div>
      <div style="font-weight:600;color:#0f172a">Vintage Linen Blazer</div>
      <div style="font-size:10px;color:#64748b;font-style:italic;margin-top:2px">Size: M, Color: Cream</div>
    </div>
    <div style="color:#475569">1 × $189.00</div>
  </div>
  <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px">
    <div>
      <div style="font-weight:600;color:#0f172a">Leather Crossbody Bag</div>
    </div>
    <div style="color:#475569">1 × $129.99</div>
  </div>
  <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px">
    <div>
      <div style="font-weight:600;color:#0f172a">Silk Scarf — Hand Painted</div>
    </div>
    <div style="color:#475569">2 × $49.50</div>
  </div>
</div>`,
  });

  bm.add("hb-conditional-status", {
    label: "If Completed",
    category: HELPERS_CATEGORY,
    media: wrapMedia(I.branch),
    content: `<div style="padding:10px 14px;background:#dcfce7;border-radius:8px;color:#166534;font-size:12px;font-weight:600">Order complete — thank you!</div>`,
  });
}
