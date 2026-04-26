import { Node, mergeAttributes } from "@tiptap/core";

export const SignatureLine = Node.create({
  name: "signatureLine",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      label: { default: "Signature" },
      width: { default: 60 },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-woo-block="signature_line"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-woo-block": "signature_line", class: "woo-block woo-block-signature" },
        HTMLAttributes,
      ),
      `${HTMLAttributes.label || "Signature"}`,
    ];
  },
});