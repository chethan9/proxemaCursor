import { Node, mergeAttributes } from "@tiptap/core";

export const QrCode = Node.create({
  name: "qr_code",
  group: "block",
  atom: true,
  addAttributes() {
    return {
      value: { default: "{{order.number}}" },
      size: { default: 120 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="qr_code"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-type": "qr_code", class: "woo-block woo-block-qr" }, HTMLAttributes),
      "QR Code",
    ];
  },
});