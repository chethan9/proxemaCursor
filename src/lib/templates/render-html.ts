import type { AnyBlock, DocumentStyles, TemplateDocument } from "./document";
import { interpolate, escapeHtml, resolvePath } from "./interpolate";

function pad(b: { paddingTop?: number; paddingBottom?: number; paddingLeft?: number; paddingRight?: number }) {
  return `padding:${b.paddingTop ?? 0}px ${b.paddingRight ?? 0}px ${b.paddingBottom ?? 0}px ${b.paddingLeft ?? 0}px;`;
}

function alignStyle(a?: "left" | "center" | "right") { return `text-align:${a ?? "left"};`; }

function renderBlock(b: AnyBlock, data: unknown, styles: DocumentStyles): string {
  switch (b.type) {
    case "text": {
      const text = escapeHtml(interpolate(b.props.text ?? "", data)).replace(/\n/g, "<br/>");
      const fw = b.props.fontWeight ?? "normal";
      return `<div style="${pad(b.props)}${alignStyle(b.props.align)}font-size:${b.props.fontSize ?? styles.baseFontSize}px;color:${b.props.color ?? styles.textColor};font-weight:${fw === "normal" ? 400 : fw === "medium" ? 500 : fw === "semibold" ? 600 : 700};line-height:1.5;">${text}</div>`;
    }
    case "heading": {
      const sizes: Record<1 | 2 | 3, number> = { 1: 24, 2: 18, 3: 14 };
      const text = escapeHtml(interpolate(b.props.text ?? "", data));
      return `<div style="${pad(b.props)}${alignStyle(b.props.align)}font-size:${sizes[b.props.level]}px;color:${b.props.color ?? styles.textColor};font-weight:700;line-height:1.3;">${text}</div>`;
    }
    case "image": {
      const src = interpolate(b.props.src ?? "", data);
      if (!src) return `<div style="${pad(b.props)}${alignStyle(b.props.align)}color:${styles.mutedColor};font-size:11px;">[image]</div>`;
      const wrapAlign = b.props.align ?? "left";
      return `<div style="${pad(b.props)}text-align:${wrapAlign};"><img src="${escapeHtml(src)}" alt="${escapeHtml(b.props.alt ?? "")}" style="max-width:100%;${b.props.width ? `width:${b.props.width}px;` : ""}${b.props.height ? `height:${b.props.height}px;` : ""}display:inline-block;" /></div>`;
    }
    case "divider":
      return `<div style="${pad(b.props)}"><div style="height:0;border-top:${b.props.thickness ?? 1}px solid ${b.props.color ?? styles.borderColor};"></div></div>`;
    case "spacer":
      return `<div style="height:${b.props.height}px;"></div>`;
    case "columns": {
      const cols = b.props.columns.map((col) => `<div style="flex:1;">${col.map((c) => renderBlock(c, data, styles)).join("")}</div>`).join(`<div style="width:${b.props.gap ?? 16}px;flex:0 0 auto;"></div>`);
      return `<div style="${pad(b.props)}display:flex;flex-direction:row;align-items:flex-start;">${cols}</div>`;
    }
    case "address_block": {
      const src = b.props.source === "billing" ? "order.billing" : "order.shipping";
      const a = resolvePath(data, src) as Record<string, string> | undefined;
      if (!a) return "";
      const lines: string[] = [];
      if (b.props.showName !== false) lines.push(`${a.first_name ?? ""} ${a.last_name ?? ""}`.trim());
      if (a.address_1) lines.push(a.address_1);
      if (a.address_2) lines.push(a.address_2);
      const cityLine = [a.city, a.state, a.postcode].filter(Boolean).join(" ");
      if (cityLine) lines.push(cityLine);
      if (a.country) lines.push(a.country);
      if (b.props.showPhone) {
        const phone = resolvePath(data, "order.customer.phone");
        if (phone) lines.push(String(phone));
      }
      const label = b.props.label ? `<div style="font-size:10px;font-weight:600;color:${styles.mutedColor};text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${escapeHtml(b.props.label)}</div>` : "";
      const body = lines.filter(Boolean).map((l) => `<div style="font-size:11px;color:${styles.textColor};line-height:1.5;">${escapeHtml(l)}</div>`).join("");
      return `<div style="${pad(b.props)}${alignStyle(b.props.align)}">${label}${body}</div>`;
    }
    case "order_items_table": {
      const items = (resolvePath(data, "order.items") as Array<Record<string, unknown>>) ?? [];
      const cols: Array<{ key: string; label: string; align: string; w?: string }> = [];
      if (b.props.showImage) cols.push({ key: "image", label: "", align: "left", w: "60px" });
      cols.push({ key: "name", label: "Product", align: "left" });
      if (b.props.showSku) cols.push({ key: "sku", label: "SKU", align: "left", w: "90px" });
      if (b.props.showQty) cols.push({ key: "quantity", label: "Qty", align: "center", w: "60px" });
      if (b.props.showPrice) cols.push({ key: "price", label: "Price", align: "right", w: "80px" });
      if (b.props.showTotal) cols.push({ key: "total", label: "Total", align: "right", w: "80px" });
      const head = `<tr style="background:${b.props.headerColor ?? "#F8FAFC"};">${cols.map((c) => `<th style="text-align:${c.align};padding:8px 10px;font-size:10px;font-weight:600;color:${styles.mutedColor};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid ${styles.borderColor};${c.w ? `width:${c.w};` : ""}">${escapeHtml(c.label)}</th>`).join("")}</tr>`;
      const body = items.map((it) => `<tr>${cols.map((c) => {
        if (c.key === "image") {
          const src = it.image as string | undefined;
          return `<td style="padding:8px 10px;border-bottom:1px solid ${styles.borderColor};">${src ? `<img src="${escapeHtml(src)}" style="width:36px;height:36px;border-radius:4px;object-fit:cover;" />` : ""}</td>`;
        }
        return `<td style="padding:8px 10px;font-size:11px;color:${styles.textColor};text-align:${c.align};border-bottom:1px solid ${styles.borderColor};">${escapeHtml(String(it[c.key] ?? ""))}</td>`;
      }).join("")}</tr>`).join("");
      return `<div style="${pad(b.props)}"><table style="width:100%;border-collapse:collapse;">${head}${body}</table></div>`;
    }
    case "totals_block": {
      const t = (resolvePath(data, "order.totals") as Record<string, string>) ?? {};
      const cur = (resolvePath(data, "order.currency") as string) ?? "";
      const rows: Array<[string, string, boolean]> = [];
      if (b.props.showSubtotal) rows.push(["Subtotal", t.subtotal ?? "", false]);
      if (b.props.showShipping) rows.push(["Shipping", t.shipping ?? "", false]);
      if (b.props.showTax) rows.push(["Tax", t.tax ?? "", false]);
      if (b.props.showDiscount && Number(t.discount ?? 0) > 0) rows.push(["Discount", `-${t.discount}`, false]);
      if (b.props.showTotal) rows.push(["Total", t.total ?? "", true]);
      const html = rows.map(([k, v, emph]) => `<tr><td style="padding:6px 0;font-size:${emph ? 13 : 11}px;font-weight:${emph ? 700 : 400};color:${styles.textColor};${emph ? `border-top:2px solid ${styles.textColor};padding-top:8px;` : ""}">${escapeHtml(k)}</td><td style="padding:6px 0;text-align:right;font-size:${emph ? 13 : 11}px;font-weight:${emph ? 700 : 500};color:${styles.textColor};${emph ? `border-top:2px solid ${styles.textColor};padding-top:8px;` : ""}">${escapeHtml(v)} ${escapeHtml(cur)}</td></tr>`).join("");
      return `<div style="${pad(b.props)}display:flex;justify-content:flex-end;"><table style="min-width:240px;border-collapse:collapse;">${html}</table></div>`;
    }
    case "barcode": {
      const val = b.props.source === "custom" ? (b.props.value ?? "") : (resolvePath(data, "order.number") as string ?? "");
      return `<div style="${pad(b.props)}${alignStyle(b.props.align)}"><div style="display:inline-block;padding:8px 12px;background:#fff;border:1px solid ${styles.borderColor};"><div style="font-family:'Libre Barcode 128',monospace;font-size:${b.props.height ?? 60}px;letter-spacing:1px;line-height:1;">${escapeHtml(String(val))}</div><div style="font-size:9px;color:${styles.mutedColor};margin-top:4px;letter-spacing:2px;text-align:center;">${escapeHtml(String(val))}</div></div></div>`;
    }
    case "qr_code": {
      const val = interpolate(b.props.value ?? "", data);
      const size = b.props.size ?? 80;
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(val)}`;
      return `<div style="${pad(b.props)}${alignStyle(b.props.align)}"><img src="${url}" width="${size}" height="${size}" style="display:inline-block;" /></div>`;
    }
    case "signature_line": {
      const w = b.props.widthPercent ?? 60;
      return `<div style="${pad(b.props)}"><div style="width:${w}%;border-bottom:1px solid ${styles.textColor};height:1px;"></div><div style="font-size:10px;color:${styles.mutedColor};margin-top:4px;">${escapeHtml(b.props.label ?? "Signature")}</div></div>`;
    }
    case "html":
      return `<div>${interpolate(b.props.html ?? "", data)}</div>`;
    case "page_break":
      return `<div style="page-break-after:always;height:0;"></div>`;
  }
}

export function renderDocumentToHtml(doc: TemplateDocument, data: unknown, styles: DocumentStyles): string {
  const m = doc.page.margins;
  const inner = doc.blocks.map((b) => renderBlock(b, data, styles)).join("");
  return `<div style="font-family:${styles.fontFamily};color:${styles.textColor};background:#fff;padding:${m.top}px ${m.right}px ${m.bottom}px ${m.left}px;font-size:${styles.baseFontSize}px;line-height:1.5;">${inner}</div>`;
}