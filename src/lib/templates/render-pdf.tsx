import React from "react";
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import type { TemplateDocument, AnyBlock, DocumentStyles } from "./document";
import { interpolate, resolvePath } from "./interpolate";

const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595, 842],
  Letter: [612, 792],
  Legal: [612, 1008],
};

function buildStyles(s: DocumentStyles) {
  return StyleSheet.create({
    body: { fontFamily: "Helvetica", fontSize: s.baseFontSize, color: s.textColor, lineHeight: 1.5 },
    h1: { fontSize: 24, fontFamily: "Helvetica-Bold", marginBottom: 8 },
    h2: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 6 },
    h3: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 6 },
    h4: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    h5: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    h6: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 4 },
    text: { fontSize: s.baseFontSize },
    muted: { color: "#6b7280", fontSize: s.baseFontSize - 1 },
    label: { fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
    tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingVertical: 6 },
    tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingVertical: 8 },
    th: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 },
    td: { fontSize: s.baseFontSize },
    totalsRow: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 4 },
    totalsLabel: { fontSize: s.baseFontSize, color: "#6b7280", marginRight: 24 },
    totalsValue: { fontSize: s.baseFontSize, minWidth: 80, textAlign: "right" },
    grandTotal: { fontSize: s.baseFontSize + 3, fontFamily: "Helvetica-Bold", color: s.primaryColor },
  });
}

interface RenderCtx {
  data: Record<string, unknown>;
  styles: ReturnType<typeof buildStyles>;
  doc: DocumentStyles;
}

function alignToFlex(a?: string): "flex-start" | "center" | "flex-end" {
  if (a === "center") return "center";
  if (a === "right") return "flex-end";
  return "flex-start";
}

function renderBlock(block: AnyBlock, ctx: RenderCtx, key: string | number): React.ReactElement | null {
  const { data, styles, doc } = ctx;
  switch (block.type) {
    case "text": {
      const txt = interpolate(block.props.text || "", data);
      return (
        <View key={key} style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: block.props.fontSize ?? doc.baseFontSize, color: block.props.color || doc.textColor, textAlign: (block.props.align as "left" | "center" | "right") || "left" }}>{txt}</Text>
        </View>
      );
    }
    case "heading": {
      const txt = interpolate(block.props.text || "", data);
      const level = block.props.level || 2;
      const levelStyle = styles[`h${level}` as keyof typeof styles] as object;
      return (
        <View key={key} style={{ marginBottom: 6 }}>
          <Text style={{ ...(levelStyle || {}), color: block.props.color || doc.textColor, textAlign: (block.props.align as "left" | "center" | "right") || "left" }}>{txt}</Text>
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
      return <View key={key} style={{ height: 1, backgroundColor: block.props.color || "#e5e7eb", marginVertical: 12 }} />;
    case "spacer":
      return <View key={key} style={{ height: block.props.height || 16 }} />;
    case "columns": {
      const gap = block.props.gap ?? 16;
      const colCount = block.props.columns?.length || 2;
      return (
        <View key={key} style={{ flexDirection: "row", gap, marginBottom: 6 }}>
          {block.props.columns.map((col, i) => (
            <View key={i} style={{ flex: 1, width: `${100 / colCount}%` }}>
              {col.children.map((c, j) => renderBlock(c, ctx, j))}
            </View>
          ))}
        </View>
      );
    }
    case "address_block": {
      const addr = (resolvePath(data, block.props.source || "billing") as Record<string, string>) || {};
      const lines = [
        block.props.label,
        `${addr.first_name || ""} ${addr.last_name || ""}`.trim(),
        addr.address_1,
        addr.address_2,
        [addr.city, addr.state, addr.postcode].filter(Boolean).join(", "),
        addr.country,
      ].filter(Boolean) as string[];
      return (
        <View key={key} style={{ marginBottom: 6 }}>
          {block.props.label && <Text style={styles.label}>{block.props.label}</Text>}
          {lines.slice(block.props.label ? 1 : 0).map((line, i) => (
            <Text key={i} style={styles.text}>{line}</Text>
          ))}
        </View>
      );
    }
    case "order_items_table": {
      const items = (resolvePath(data, "order.items") as Array<Record<string, unknown>>) || [];
      const cols = block.props.columns || [];
      const visibleCols = cols.filter((c) => c.visible !== false);
      return (
        <View key={key} style={{ marginVertical: 8 }}>
          <View style={styles.tableHeader}>
            {visibleCols.map((c) => (
              <Text key={c.field} style={[styles.th, { flex: c.flex || 1, textAlign: c.align || "left" }]}>{c.label}</Text>
            ))}
          </View>
          {items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              {visibleCols.map((c) => (
                <Text key={c.field} style={[styles.td, { flex: c.flex || 1, textAlign: c.align || "left" }]}>{String(item[c.field] ?? "")}</Text>
              ))}
            </View>
          ))}
        </View>
      );
    }
    case "totals_block": {
      const order = (data.order as Record<string, string>) || {};
      const rows = block.props.rows || [];
      return (
        <View key={key} style={{ marginVertical: 8, alignItems: "flex-end" }}>
          {rows.filter((r) => r.visible !== false).map((row, i) => {
            const value = String(order[row.field] ?? "0.00");
            const isTotal = row.field === "total";
            return (
              <View key={i} style={styles.totalsRow}>
                <Text style={isTotal ? [styles.totalsLabel, { fontFamily: "Helvetica-Bold", color: doc.textColor }] : styles.totalsLabel}>{row.label}</Text>
                <Text style={isTotal ? [styles.totalsValue, styles.grandTotal] : styles.totalsValue}>{order.currency || ""} {value}</Text>
              </View>
            );
          })}
        </View>
      );
    }
    case "barcode":
    case "qr_code":
      return (
        <View key={key} style={{ alignItems: alignToFlex(block.props.align), marginVertical: 8 }}>
          <View style={{ width: block.props.width || 160, height: block.props.height || 60, borderWidth: 1, borderColor: "#e5e7eb", justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 8, color: "#9ca3af" }}>[{block.type}: {interpolate(block.props.value || "", data)}]</Text>
          </View>
        </View>
      );
    case "signature_line":
      return (
        <View key={key} style={{ marginTop: 24, marginBottom: 8, width: block.props.width || 200 }}>
          <View style={{ borderBottomWidth: 1, borderBottomColor: "#9ca3af", height: 24 }} />
          <Text style={{ fontSize: 9, color: "#6b7280", marginTop: 4 }}>{block.props.label || "Signature"}</Text>
        </View>
      );
    case "html":
      return null;
    case "page_break":
      return <View key={key} break />;
    default:
      return null;
  }
}

interface DocProps { doc: TemplateDocument; data: Record<string, unknown> }
const TemplatePdfDocument: React.FC<DocProps> = ({ doc, data }) => {
  const styles = buildStyles(doc.styles);
  const size = PAGE_SIZES[doc.page.size] || PAGE_SIZES.A4;
  const m = doc.page.margins;
  return (
    <Document>
      <Page size={size} orientation={doc.page.orientation || "portrait"} style={{ padding: 0, backgroundColor: doc.styles.backgroundColor }}>
        <View style={[styles.body, { paddingTop: m.top, paddingBottom: m.bottom, paddingLeft: m.left, paddingRight: m.right }]}>
          {doc.blocks.map((b, i) => renderBlock(b, { data, styles, doc: doc.styles }, i))}
        </View>
      </Page>
    </Document>
  );
};

export async function renderTemplatePdf(doc: TemplateDocument, data: Record<string, unknown>): Promise<Buffer> {
  const stream = await pdf(<TemplatePdfDocument doc={doc} data={data} />).toBuffer();
  return stream as unknown as Buffer;
}