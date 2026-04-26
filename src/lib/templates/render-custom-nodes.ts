import type { JSONContent } from "@tiptap/core";
import bwipjs from "bwip-js";
import QRCode from "qrcode";

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Record<string, unknown>)[k] : undefined), obj);
}

function interp(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = get(data, k);
    return v === undefined || v === null ? "" : String(v);
  });
}

interface Attrs { [k: string]: unknown }

function renderItemsTable(attrs: Attrs, data: Record<string, unknown>): string {
  const items = (get(data, "order.items") as Array<Record<string, unknown>>) || [];
  const cur = (get(data, "order.currency") as string) || "";
  const cols: Array<{ key: string; label: string }> = [];
  if (attrs.showImage) cols.push({ key: "image", label: "" });
  cols.push({ key: "name", label: "Product" });
  if (attrs.showSku) cols.push({ key: "sku", label: "SKU" });
  if (attrs.showQty) cols.push({ key: "quantity", label: "Qty" });
  if (attrs.showPrice) cols.push({ key: "price", label: "Price" });
  if (attrs.showTotal) cols.push({ key: "total", label: "Total" });
  const header = cols.map((c) => `<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;font-size:11px;text-transform:uppercase;color:#6b7280">${escape(c.label)}</th>`).join("");
  const rows = items.map((item) => {
    const cells = cols.map((c) => {
      if (c.key === "image") {
        const src = String(item.image || "");
        return `<td style="padding:8px;border-bottom:1px solid #f3f4f6;width:48px">${src ? `<img src="${escape(src)}" width="40" style="border-radius:4px"/>` : ""}</td>`;
      }
      let v = String(item[c.key] ?? "");
      if ((c.key === "price" || c.key === "total") && cur) v = `${cur} ${v}`;
      return `<td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:14px">${escape(v)}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  const headerBg = String(attrs.headerColor || "#F8FAFC");
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0"><thead style="background:${escape(headerBg)}"><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTotals(attrs: Attrs, data: Record<string, unknown>): string {
  const totals = (get(data, "order.totals") as Record<string, string>) || (get(data, "order") as Record<string, string>) || {};
  const cur = (get(data, "order.currency") as string) || "";
  const rows: Array<[string, string, boolean]> = [];
  if (attrs.showSubtotal) rows.push(["Subtotal", totals.subtotal ?? "0.00", false]);
  if (attrs.showShipping) rows.push(["Shipping", totals.shipping ?? "0.00", false]);
  if (attrs.showTax) rows.push(["Tax", totals.tax ?? "0.00", false]);
  if (attrs.showDiscount && Number(totals.discount ?? 0) !== 0) rows.push(["Discount", `-${totals.discount}`, false]);
  if (attrs.showTotal) rows.push(["Total", totals.total ?? "0.00", true]);
  const html = rows.map(([label, val, big]) => `<tr><td style="padding:6px 12px;text-align:right;color:#6b7280;font-size:${big ? 16 : 13}px;${big ? "font-weight:700;color:#111827;" : ""}">${escape(label)}</td><td style="padding:6px 12px;text-align:right;font-size:${big ? 18 : 13}px;${big ? "font-weight:700;color:#111827;" : ""}">${escape(cur)} ${escape(val)}</td></tr>`).join("");
  return `<table style="width:100%;border-collapse:collapse;margin:12px 0"><tbody>${html}</tbody></table>`;
}

function renderAddress(attrs: Attrs, data: Record<string, unknown>): string {
  const src = attrs.source === "shipping" ? "order.shipping" : "order.billing";
  const a = (get(data, src) as Record<string, string>) || {};
  const lines = [
    `${a.first_name || ""} ${a.last_name || ""}`.trim(),
    a.address_1,
    a.address_2,
    [a.city, a.state, a.postcode].filter(Boolean).join(", "),
    a.country,
  ].filter(Boolean);
  const label = String(attrs.label || "");
  return `<div style="margin:12px 0">${label ? `<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;margin-bottom:6px;font-weight:600">${escape(label)}</div>` : ""}${lines.map((l) => `<div style="font-size:14px;line-height:1.5">${escape(String(l))}</div>`).join("")}</div>`;
}

async function renderBarcode(attrs: Attrs, data: Record<string, unknown>): Promise<string> {
  const val = attrs.source === "custom" ? String(attrs.value || "") : String(get(data, "order.number") || "");
  if (!val) return `<div style="padding:8px;color:#9ca3af;font-size:12px">No barcode value</div>`;
  try {
    const png = await bwipjs.toBuffer({
      bcid: String(attrs.format || "code128"),
      text: val,
      scale: 2,
      height: Number(attrs.height || 60) / 4,
      includetext: true,
      textxalign: "center",
    });
    const b64 = png.toString("base64");
    return `<div style="text-align:center;margin:12px 0"><img src="data:image/png;base64,${b64}" alt="${escape(val)}" style="max-width:${Number(attrs.width || 200)}px"/></div>`;
  } catch {
    return `<div style="padding:8px;color:#ef4444;font-size:12px">Barcode error: ${escape(val)}</div>`;
  }
}

async function renderQr(attrs: Attrs, data: Record<string, unknown>): Promise<string> {
  const val = interp(String(attrs.value || ""), data) || "";
  if (!val) return `<div style="padding:8px;color:#9ca3af;font-size:12px">No QR value</div>`;
  try {
    const dataUrl = await QRCode.toDataURL(val, { width: Number(attrs.size || 120), margin: 1 });
    return `<div style="text-align:center;margin:12px 0"><img src="${dataUrl}" alt="QR ${escape(val)}" width="${Number(attrs.size || 120)}"/></div>`;
  } catch {
    return `<div style="padding:8px;color:#ef4444;font-size:12px">QR error</div>`;
  }
}

async function renderNode(node: JSONContent, data: Record<string, unknown>): Promise<string | null> {
  const attrs = (node.attrs || {}) as Attrs;
  switch (node.type) {
    case "order_items_table": return renderItemsTable(attrs, data);
    case "totals_block": return renderTotals(attrs, data);
    case "address_block": return renderAddress(attrs, data);
    case "barcode": return await renderBarcode(attrs, data);
    case "qr_code": return await renderQr(attrs, data);
    default: return null;
  }
}

const CUSTOM_TYPES = new Set(["order_items_table", "totals_block", "address_block", "barcode", "qr_code"]);

export async function renderCustomNodes(doc: JSONContent, data: Record<string, unknown>): Promise<JSONContent> {
  if (!doc) return doc;
  const out: JSONContent = { ...doc };
  if (Array.isArray(doc.content)) {
    const newContent: JSONContent[] = [];
    for (const child of doc.content) {
      if (child && typeof child === "object" && CUSTOM_TYPES.has(child.type || "")) {
        const html = await renderNode(child, data);
        if (html !== null) {
          newContent.push({ type: "html", attrs: { html } });
          continue;
        }
      }
      newContent.push(await renderCustomNodes(child as JSONContent, data));
    }
    out.content = newContent;
  }
  return out;
}