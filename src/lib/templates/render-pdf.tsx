import React from "react";
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import type { TemplateDocument, AnyBlock, DocumentStyles } from "./document";
import { interpolate, resolvePath } from "./interpolate";

const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595, 842],
  Letter: [612, 792],
};

function buildStyles(s: DocumentStyles) {
  return StyleSheet.create({
    body: { fontFamily: "Helvetica", fontSize: s.baseFontSize, color: s.textColor, lineHeight: 1.5 },
    label: { fontSize: 9, color: s.mutedColor, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontFamily: "Helvetica-Bold" },
    th: { fontSize: 9, fontFamily: "Helvetica-Bold", color: s.mutedColor, textTransform: "uppercase", letterSpacing: 0.5 },
    td: { fontSize: s.baseFontSize, color: s.textColor },
    tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: s.borderColor, paddingVertical: 6 },
    tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: s.borderColor, paddingVertical: 8 },
    totalsRow: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 3 },
    totalsLabel: { fontSize: s.baseFontSize, color: s.mutedColor, marginRight: 24 },
    totalsValue: { fontSize: s.baseFontSize, minWidth: 80, textAlign: "right", color: s.textColor },
    grandTotal: { fontSize: s.baseFontSize + 3, fontFamily: "Helvetica-Bold", color: s.primaryColor },
  });
}

interface RenderCtx {
  data: Record<string, unknown>;
  styles: ReturnType<typeof buildStyles>;
  doc: DocumentStyles;
}

const HEADING_SIZES: Record<1 | 2 | 3, number> = { 1: 24, 2: 18, 3: 14 };

function alignToFlex(a?: string): "flex-start" | "center" | "flex-end" {
  if (a === "center") return "center";
  if (a === "right") return "flex-end";
  return "flex-start";
}

function alignText(a?: string): "left" | "center" | "right" {
  if (a === "center") return "center";
  if (a === "right") return "right";
  return "left";
}

function fontWeightToFamily(w?: string): string {
  if (w === "bold" || w === "semibold") return "Helvetica-Bold";
  return "Helvetica";
}

function renderBlock(block: AnyBlock, ctx: RenderCtx, key: string | number): React.ReactElement | null {
  const { data, styles, doc } = ctx;
  switch (block.type) {
    case "text": {
      const txt = interpolate(block.props.text || "", data);
      return (
        <View key={key} style={{ marginBottom: 6 }}>
          <Text style={{
            fontSize: block.props.fontSize ?? doc.baseFontSize,
            color: block.props.color || doc.textColor,
            textAlign: alignText(block.props.align),
            fontFamily: fontWeightToFamily(block.props.fontWeight),
          }}>{txt}</Text>
        </View>
      );
    }
    case "heading": {
      const txt = interpolate(block.props.text || "", data);
      return (
        <View key={key} style={{ marginBottom: 6 }}>
          <Text style={{
            fontSize: HEADING_SIZES[block.props.level],
            color: block.props.color || doc.textColor,
            textAlign: alignText(block.props.align),
            fontFamily: "Helvetica-Bold",
          }}>{txt}</Text>
        </View>
      );
    }
    case "image": {
      const src = interpolate(block.props.src || "", data);
      if (!src) return <View key={key} />;
      return (
        <View key={key} style={{ marginBottom: 6, alignItems: alignToFlex(block.props.align) }}>
          <Image src={src} style={{ width: block.props.width || 120, height: block.props.height || undefined }} />
        </View>
      );
    }
    case "divider":
      return <View key={key} style={{ height: block.props.thickness || 1, backgroundColor: block.props.color || doc.borderColor, marginVertical: 12 }} />;
    case "spacer":
      return <View key={key} style={{ height: block.props.height || 16 }} />;
    case "columns": {
      const gap = block.props.gap ?? 16;
      return (
        <View key={key} style={{ flexDirection: "row", gap, marginBottom: 6 }}>
          {block.props.columns.map((col, i) => (
            <View key={i} style={{ flex: 1 }}>
              {col.map((c, j) => renderBlock(c, ctx, j))}
            </View>
          ))}
        </View>
      );
    }
    case "address_block": {
      const src = block.props.source === "shipping" ? "order.shipping" : "order.billing";
      const addr = (resolvePath(data, src) as Record<string, string>) || {};
      const lines: string[] = [];
      if (block.props.showName !== false) lines.push(`${addr.first_name || ""} ${addr.last_name || ""}`.trim());
      if (addr.address_1) lines.push(addr.address_1);
      if (addr.address_2) lines.push(addr.address_2);
      const city = [addr.city, addr.state, addr.postcode].filter(Boolean).join(", ");
      if (city) lines.push(city);
      if (addr.country) lines.push(addr.country);
      return (
        <View key={key} style={{ marginBottom: 6 }}>
          {block.props.label && <Text style={styles.label}>{block.props.label}</Text>}
          {lines.filter(Boolean).map((line, i) => (
            <Text key={i} style={styles.td}>{line}</Text>
          ))}
        </View>
      );
    }
    case "order_items_table": {
      const items = (resolvePath(data, "order.items") as Array<Record<string, unknown>>) || [];
      const cols: Array<{ key: string; label: string; flex: number; align: "left" | "center" | "right" }> = [];
      if (block.props.showImage) cols.push({ key: "image", label: "", flex: 0.6, align: "left" });
      cols.push({ key: "name", label: "Product", flex: 2.2, align: "left" });
      if (block.props.showSku) cols.push({ key: "sku", label: "SKU", flex: 1, align: "left" });
      if (block.props.showQty) cols.push({ key: "quantity", label: "Qty", flex: 0.6, align: "center" });
      if (block.props.showPrice) cols.push({ key: "price", label: "Price", flex: 1, align: "right" });
      if (block.props.showTotal) cols.push({ key: "total", label: "Total", flex: 1, align: "right" });
      const headerBg = block.props.headerColor || "#F8FAFC";
      return (
        <View key={key} style={{ marginVertical: 8 }}>
          <View style={[styles.tableHeaderRow, { backgroundColor: headerBg }]}>
            {cols.map((c) => (
              <Text key={c.key} style={[styles.th, { flex: c.flex, textAlign: c.align, paddingHorizontal: 6 }]}>{c.label}</Text>
            ))}
          </View>
          {items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              {cols.map((c) => (
                <Text key={c.key} style={[styles.td, { flex: c.flex, textAlign: c.align, paddingHorizontal: 6 }]}>
                  {c.key === "image" ? "" : String(item[c.key] ?? "")}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    }
    case "totals_block": {
      const totals = (resolvePath(data, "order.totals") as Record<string, string>) || (data.order as Record<string, string>) || {};
      const cur = (resolvePath(data, "order.currency") as string) || "";
      const rows: Array<[string, string, boolean]> = [];
      if (block.props.showSubtotal) rows.push(["Subtotal", totals.subtotal ?? "0.00", false]);
      if (block.props.showShipping) rows.push(["Shipping", totals.shipping ?? totals.shipping_total ?? "0.00", false]);
      if (block.props.showTax) rows.push(["Tax", totals.tax ?? totals.tax_total ?? "0.00", false]);
      if (block.props.showDiscount && Number(totals.discount ?? totals.discount_total ?? 0) > 0) rows.push(["Discount", `-${totals.discount ?? totals.discount_total}`, false]);
      if (block.props.showTotal) rows.push(["Total", totals.total ?? "0.00", true]);
      return (
        <View key={key} style={{ marginVertical: 8 }}>
          {rows.map(([label, val, isTotal], i) => (
            <View key={i} style={styles.totalsRow}>
              <Text style={isTotal ? [styles.totalsLabel, { fontFamily: "Helvetica-Bold", color: doc.textColor }] : styles.totalsLabel}>{label}</Text>
              <Text style={isTotal ? styles.grandTotal : styles.totalsValue}>{cur} {val}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "barcode": {
      const val = block.props.source === "custom" ? (block.props.value || "") : (resolvePath(data, "order.number") as string) || "";
      return (
        <View key={key} style={{ alignItems: alignToFlex(block.props.align), marginVertical: 8 }}>
          <View style={{ width: block.props.width || 200, height: block.props.height || 60, borderWidth: 1, borderColor: doc.borderColor, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 9, color: doc.mutedColor, letterSpacing: 2 }}>||| {val} |||</Text>
          </View>
        </View>
      );
    }
    case "qr_code": {
      const val = interpolate(block.props.value || "", data);
      const size = block.props.size || 80;
      return (
        <View key={key} style={{ alignItems: alignToFlex(block.props.align), marginVertical: 8 }}>
          <View style={{ width: size, height: size, borderWidth: 1, borderColor: doc.borderColor, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 7, color: doc.mutedColor }}>{val.slice(0, 12)}</Text>
          </View>
        </View>
      );
    }
    case "signature_line": {
      const widthPct = block.props.widthPercent ?? 60;
      return (
        <View key={key} style={{ marginTop: 24, marginBottom: 8, width: `${widthPct}%` }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: doc.textColor, height: 24 }} />
          <Text style={{ fontSize: 9, color: doc.mutedColor, marginTop: 4 }}>{block.props.label || "Signature"}</Text>
        </View>
      );
    }
    case "html":
      return null;
    case "page_break":
      return <View key={key} break />;
    default:
      return null;
  }
}

interface DocProps { doc: TemplateDocument; styles: DocumentStyles; data: Record<string, unknown> }
const TemplatePdfDocument: React.FC<DocProps> = ({ doc, styles, data }) => {
  const ctxStyles = buildStyles(styles);
  const size = PAGE_SIZES[doc.page.size] || PAGE_SIZES.A4;
  const m = doc.page.margins;
  return (
    <Document>
      <Page size={size} orientation={doc.page.orientation || "portrait"} style={{ padding: 0, backgroundColor: "#fff" }}>
        <View style={[ctxStyles.body, { paddingTop: m.top, paddingBottom: m.bottom, paddingLeft: m.left, paddingRight: m.right }]}>
          {doc.blocks.map((b, i) => renderBlock(b, { data, styles: ctxStyles, doc: styles }, i))}
        </View>
      </Page>
    </Document>
  );
};

export async function renderTemplatePdf(doc: TemplateDocument, styles: DocumentStyles, data: Record<string, unknown>): Promise<Buffer> {
  const buf = await pdf(<TemplatePdfDocument doc={doc} styles={styles} data={data} />).toBuffer();
  return buf as unknown as Buffer;
}