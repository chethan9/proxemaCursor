import { Node, mergeAttributes } from "@tiptap/core";

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  parseHTML() {
    return [{ tag: 'div[data-woo-block="page_break"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-woo-block": "page_break", class: "woo-block woo-block-page-break" },
        HTMLAttributes,
      ),
      "— Page break —",
    ];
  },
});