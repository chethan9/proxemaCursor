import { Node, mergeAttributes } from "@tiptap/core";

export const OrderItemsTable = Node.create({
  name: "order_items_table",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      showImage: { default: true },
      showSku: { default: true },
      showQty: { default: true },
      showPrice: { default: true },
      showTotal: { default: true },
      headerColor: { default: "#F8FAFC" },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="order_items_table"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": "order_items_table", class: "woo-block woo-block-items" }, HTMLAttributes),
      "Order Items Table",
    ];
  },
});