import { Node, mergeAttributes } from "@tiptap/core";

export const TotalsBlock = Node.create({
  name: "totals_block",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      showSubtotal: { default: true },
      showShipping: { default: true },
      showTax: { default: true },
      showDiscount: { default: true },
      showTotal: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="totals_block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": "totals_block", class: "woo-block woo-block-totals" }, HTMLAttributes),
      "Totals",
    ];
  },
});