---
title: Polish variation dialog and quick-edit table UI
status: todo
priority: high
type: feature
tags: [product-edit, variations, ui-polish]
created_by: agent
created_at: 2026-04-20
position: 95
---

## Notes

Refine the variation editing UI to match the reference design (2nd screenshot: "Edit Ceramic / White / 150 ml" dialog and the quick-edit variations table). Current implementation is functional but spacing, typography, and controls need tightening. Also add Sale Price to the quick-edit table row so users can manage discounts without opening the deep dialog.

**Reference files:**
- `src/components/product-edit/variants/VariationEditDialog.tsx` — deep-edit dialog
- `src/components/product-edit/variants/VariationsTable.tsx` — quick-edit table
- `src/services/productEditService.ts` — `Variation.sale_price` already exists

**Deep-edit dialog refinements (match reference):**
- Dialog title: "Edit {option labels}" (already correct)
- Price row: Regular Price and Offer Price side-by-side, each with a currency suffix dropdown/label (store currency like "KWD") inside the input on the right edge — visually one field with currency indicator, not a separate field
- Images row: Variation Image (single tile on left, labelled "Default" underneath when set as main) + Variation Gallery (inline thumbnails + dashed "+" tile) laid out horizontally in a single row, NOT stacked. Gallery tiles should be the same square size as the main image (~96px), rounded-lg, hover shows remove button
- Section headers ("Inventory", "Shipping") should be bolder, larger (text-base font-semibold), with a subtle divider line above each section (not around the whole section)
- Inventory row: SKU, Quantity, Stock Status as 3 equal columns in ONE row (not stacked)
- Shipping: Weight (kg) + Dimensions (Length / Width / Height in cm) — single row with Weight on the left (smaller) and 3 dimension inputs grouped on the right. Labels should show unit hints like "Weight (kg)" and "Dimensions (cm)" as shown in reference
- Flags (Enabled / Virtual / Downloadable / Manage Stock) — use radio-style circular indicators or cleaner checkboxes, spaced generously in one row, no background pills
- Description: full-width textarea below flags
- Footer: "Remove" (red text, left) — Cancel + Save & Edit Next + Save Changes (right, separated with 8px gap). Save Changes is the primary solid dark button; Save & Edit Next is white with border; Cancel is ghost
- Overall: more generous padding (p-6 on content, gap-5 between sections), softer borders (border-border/60), subtle section dividers

**Quick-edit table refinements:**
- Add a Sale Price column between Price and Stock so discounts can be edited inline without opening the dialog
- Column headers: Options | SKU | Regular Price | Sale Price | Stock | (edit icon)
- Grid: `grid-cols-[32px_1fr_120px_110px_110px_90px_48px]` (added 110px for sale price)
- Inputs: larger h-9 (currently h-8), softer border, proper placeholder dashes "—"
- Bulk actions menu should include "Set sale price" (already exists) — verify it targets `sale_price` field correctly
- Row hover: subtle bg-muted/30

**Layout/spacing details:**
- Dialog max-width: `sm:max-w-2xl` (currently likely smaller)
- Content padding increase to 24px all around
- Use lucide-react ImageIcon for empty image slots
- All Input components: use `className="h-9"` for consistency with reference's taller fields

**Constraints:**
- Keep VariationEditDialog under 250 lines after changes (currently 186 — room to add sections)
- No new dependencies; use existing shadcn Dialog, Input, Label, Checkbox, Button
- `sale_price` field already exists in `Variation` type — just surface it in the table

## Checklist

- [ ] Quick-edit table: add Sale Price column between Regular Price and Stock with inline input that updates `variation.sale_price`
- [ ] Quick-edit table: adjust column widths and increase row height (h-9 inputs, py-2.5 rows) for better visual rhythm
- [ ] Deep-edit dialog: price row — Regular Price + Offer Price side-by-side with currency suffix displayed inside each input (e.g. right-aligned "KWD" text)
- [ ] Deep-edit dialog: image row — Variation Image tile + Variation Gallery thumbnails + "+" add tile, all in a single horizontal row, equal size tiles (96×96), rounded corners
- [ ] Deep-edit dialog: "Default" caption under the main variation image when set
- [ ] Deep-edit dialog: Inventory section — SKU / Quantity / Stock Status in a 3-column grid, with larger section heading and top divider
- [ ] Deep-edit dialog: Shipping section — Weight (kg) on left, Dimensions (Length / Width / Height in cm) as 3 grouped inputs on right, with unit hints in labels
- [ ] Deep-edit dialog: flags row — Enabled / Virtual / Downloadable / Manage Stock as clean horizontal checkboxes without background pills
- [ ] Deep-edit dialog: full-width Description textarea
- [ ] Deep-edit dialog: footer layout — Remove (red, left) on one side, Cancel + Save & Edit Next + Save Changes (right) with proper button hierarchy (ghost / outline / solid dark)
- [ ] Increase dialog max-width to sm:max-w-2xl for more breathing room
- [ ] Add subtle section dividers (border-t border-border/60) between Price, Images, Inventory, Shipping, Flags, Description

## Acceptance

- Opening the variation edit dialog shows Regular and Offer price in one row with currency "KWD" shown inside each field.
- Variation Image and Gallery tiles appear side-by-side in a single horizontal row, equal size.
- Inventory (SKU, Quantity, Stock Status) sits in a 3-column row, Shipping (Weight + 3 dimensions) in a clean grid row.
- Quick-edit variations table now has a Sale Price column; editing it and saving persists the discount to WooCommerce.
- The overall dialog feels closer to the reference design: more whitespace, bolder section headings, cleaner button hierarchy in the footer.