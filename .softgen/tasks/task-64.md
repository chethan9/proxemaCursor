---
title: Advanced - Variants tab (Simple + Variable product)
status: todo
priority: urgent
type: feature
tags: [product-edit, advanced, variants]
created_by: agent
created_at: 2026-04-19
position: 64
---

## Notes
Fourth tab — the most complex. Two modes (Simple Product / Variable Product) toggled by a top tabs-inside-tab (reference screenshots 7 and 8).

**Component:** `src/components/product-edit/tabs/VariantsTab.tsx`

**Simple Product mode (screenshot 7):**
- Attribute editor card: expanded by default when user clicks "+ Add new attribute"
  - Attribute name input (autocomplete with existing global attributes; new name = create global attribute on save)
  - Values list: one input per value with trash icon on right, "Add new option" empty input appears at bottom, Enter adds another
  - Global attribute toggle: "Create as global attribute (reusable)" (defaults ON per user preference, per earlier decision — default ON with toggle visible)
  - Delete button (left) + Save Attribute button (right, black pill)
- Below the editor: list of attributes as toggleable cards with checkbox (use/don't use for this product), values shown as chips, "Edit" button per attribute opens the editor inline

**Variable Product mode (screenshot 8):**
- Variants section: same attribute list UI as simple, but attributes marked for variation (checkbox). Values shown as chips with orange dot indicator on "default" value.
- "+ Add new attribute" button at bottom
- **Variables section:** auto-generated table with columns: Options (combination label like "Ceramic / White / 150 ml"), SKU, Price, Stock — each cell is inline-editable
  - Row click opens variation detail dialog (screenshot 9)
  - Auto-regenerate on attribute value change (prompt: "Regenerate N variations? Existing SKU/price/stock will be preserved where option combinations match")

**Variation detail dialog (screenshot 9 — `src/components/product-edit/VariationEditorDialog.tsx`):**
- Title: "Edit {attribute combo}" e.g. "Edit Ceramic / White / 150 ml"
- Regular Price + Offer Price (currency suffix each)
- Variation Image (single) + Variation Gallery (multi) — both via ImagePickerDialog
- Inventory: SKU, Quantity, Stock Status dropdown
- Shipping: Weight + Dimensions (Length/Width/Height)
- Description textarea
- Footer: Remove (destructive link on left) + Cancel + Save & Edit Next + Save Changes (primary)

**Save & Edit Next:** saves current variation, closes and immediately opens the next variation's dialog in the list — essential for bulk editing.

**Regeneration logic:**
When attribute values change, diff current variations vs new cartesian product. Match by attribute-value combo hash; preserve price/sku/stock/images for matches; create new blank rows for new combos; soft-delete missing (tombstone, confirm before publish).

## Checklist
- [ ] Simple vs Variable mode toggle at top of variants tab
- [ ] Attribute editor with name autocomplete, values list with add/delete, global-attribute toggle, save/delete actions
- [ ] Attribute cards list with use-in-product checkbox, edit-inline, value chips display
- [ ] Variable mode: auto-generated variations table with inline-edit SKU / Price / Stock columns
- [ ] Variation detail dialog with price, offer price, image + gallery, SKU, quantity, stock status, weight, dimensions, description, Remove + Save & Edit Next + Save Changes
- [ ] Regeneration diff preserves existing variation data when attribute values change
- [ ] Global attribute toggle: when ON creates/updates store-level attribute via WooCommerce API; when OFF stores as custom product-level attribute

## Acceptance
- User creates a Variable product with 2 attributes (Color × Size), sees 4 auto-generated variations, edits each via dialog, publishes — all variations appear in Woo with correct SKU/price/stock
- Adding a new attribute value regenerates variations and preserves existing data
- Global attributes created here appear in the next new product's attribute autocomplete