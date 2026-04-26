import { Node, mergeAttributes } from "@tiptap/core";

export const Barcode = Node.create({
  name: "barcode",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      source: { default: "order_number" },
      value: { default: "" },
      format: { default: "code128" },
      width: { default: 200 },
      height: { default: 60 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="barcode"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": "barcode", class: "woo-block woo-block-barcode" }, HTMLAttributes),
      "Barcode",
    ];
  },
});