import { Node, mergeAttributes } from "@tiptap/core";

export const AddressBlock = Node.create({
  name: "address_block",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      source: { default: "billing" },
      label: { default: "Billing Address" },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="address_block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": "address_block", class: "woo-block woo-block-address" }, HTMLAttributes),
      `${HTMLAttributes.source === "shipping" ? "Shipping" : "Billing"} Address`,
    ];
  },
});