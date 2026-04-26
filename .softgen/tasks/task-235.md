---
title: Live Preview only shows Size/Color attributes, ignores all others
status: done
priority: medium
type: bug
tags: [products, editor, preview, ux]
created_by: agent
created_at: 2026-04-26
position: 235
---

## Notes

User reports: editing an attribute name (e.g., renaming "Color" to "Colour", or adding "Material") makes the attribute disappear from the right-side Live Preview card.

### Root cause

`src/components/product-edit/LivePreviewCard.tsx` hardcodes attribute lookup:

```ts
const sizeAttr = form.attributes.find((a) => a.name.toLowerCase() === "size");
const colorAttr = form.attributes.find((a) => a.name.toLowerCase() === "color");
```

Then renders only those two. Any attribute named anything else (Material, Style, Pattern, Capacity, or a renamed Color) is invisible in the preview.

### Fix direction

Replace the two hardcoded lookups with a generic loop that renders **every visible attribute** the user has added:

- Filter `form.attributes` for items with `visible: true` and at least one option.
- For each, render a section with the attribute name as the heading and its options as chips (same visual style as the current Size/Color blocks).
- Cap at maybe 4 attributes shown in preview to avoid the card growing too tall; if more, show "+N more".
- Keep the existing layout flow — preview card stays compact, attribute sections stack between price and the Stock/Weight/SKU row.

## Checklist

- [x] Replace the hardcoded `sizeAttr` / `colorAttr` lookups in `LivePreviewCard.tsx` with a single map over visible attributes (those with `visible: true` and `options.length > 0`).
- [x] Render each attribute as a labeled section: attribute name as the small uppercase muted label, options as the same chip/pill style currently used for size/color.
- [x] If an attribute name is empty or whitespace-only, skip it.
- [x] Cap rendered attributes at 4; if more exist, append a "+N more" pill at the end of the last section.
- [x] Verify by adding attributes named "Material", "Pattern", "Custom Thing" and confirming they all appear in the preview. Renaming "Color" → "Colour" should keep it visible.

## Acceptance

- Adding any attribute (name + options) makes it appear in the Live Preview card immediately.
- Renaming an attribute updates the preview's section heading.
- Hiding an attribute (visible toggle off) removes it from the preview but keeps it in the form data.