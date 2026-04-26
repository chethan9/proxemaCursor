import type { AnyBlock, BlockType } from "./document";

let counter = 0;
export const newBlockId = (): string => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

export interface BlockMeta {
  type: BlockType;
  label: string;
  group: "basic" | "blocks";
  description: string;
}

export const ELEMENT_META: BlockMeta[] = [
  { type: "text", label: "Text", group: "basic", description: "Paragraph text" },
  { type: "heading", label: "Heading", group: "basic", description: "Title or section header" },
  { type: "image", label: "Image", group: "basic", description: "Logo or photo" },
  { type: "divider", label: "Divider", group: "basic", description: "Horizontal line" },
  { type: "spacer", label: "Spacer", group: "basic", description: "Vertical gap" },
  { type: "columns", label: "Columns", group: "basic", description: "2 or 3 column layout" },
  { type: "html", label: "HTML", group: "basic", description: "Raw HTML escape hatch" },
];

export const BLOCK_META: BlockMeta[] = [
  { type: "address_block", label: "Address", group: "blocks", description: "Billing or shipping" },
  { type: "order_items_table", label: "Order Items", group: "blocks", description: "Line items table" },
  { type: "totals_block", label: "Totals", group: "blocks", description: "Subtotal, tax, total" },
  { type: "barcode", label: "Barcode", group: "blocks", description: "Code128 of order #" },
  { type: "qr_code", label: "QR Code", group: "blocks", description: "Scannable QR code" },
  { type: "signature_line", label: "Signature", group: "blocks", description: "Sign here line" },
  { type: "page_break", label: "Page Break", group: "blocks", description: "PDF page break" },
];

export function createBlock(type: BlockType): AnyBlock {
  const id = newBlockId();
  switch (type) {
    case "text": return { id, type, props: { text: "Type something...", fontSize: 11, color: "#0F172A" } };
    case "heading": return { id, type, props: { text: "Heading", level: 2, color: "#0F172A" } };
    case "image": return { id, type, props: { src: "{{store.logo}}", width: 120, alt: "Logo" } };
    case "divider": return { id, type, props: { color: "#E2E8F0", thickness: 1, paddingTop: 8, paddingBottom: 8 } };
    case "spacer": return { id, type, props: { height: 16 } };
    case "columns": return { id, type, props: { count: 2, gap: 16, columns: [[], []] } };
    case "address_block": return { id, type, props: { source: "billing", showName: true, showPhone: true, label: "Billing Address" } };
    case "order_items_table": return { id, type, props: { showImage: true, showSku: true, showQty: true, showPrice: true, showTotal: true, headerColor: "#F1F5F9" } };
    case "totals_block": return { id, type, props: { showSubtotal: true, showShipping: true, showTax: true, showDiscount: true, showTotal: true, emphasize: "total" } };
    case "barcode": return { id, type, props: { source: "order_number", format: "code128", width: 200, height: 60 } };
    case "qr_code": return { id, type, props: { value: "{{order.number}}", size: 80 } };
    case "signature_line": return { id, type, props: { label: "Signature", widthPercent: 60, paddingTop: 32 } };
    case "html": return { id, type, props: { html: "<p>Custom HTML</p>" } };
    case "page_break": return { id, type, props: {} };
  }
}