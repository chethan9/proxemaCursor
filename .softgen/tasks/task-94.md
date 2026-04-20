---
title: Advanced variation management (two-level editing)
status: todo
priority: high
type: feature
tags: [product-edit, variations, woocommerce]
created_by: agent
created_at: 2026-04-20
position: 94
---

## Notes

Upgrade the Variants tab in the product editor to fully manage WooCommerce variations with two levels of editing — inline quick-edit for common fields and a deep-dive dialog for full per-variation details.

**Reference files:**
- `src/components/product-edit/tabs/VariantsTab.tsx` — current implementation (inline row with SKU/price/stock + dialog shell already partially built)
- `src/services/productEditService.ts` — `Variation` type already includes all needed fields (image, gallery missing, dimensions, description, stock_status, manage_stock, weight)
- `src/pages/api/stores/[storeId]/products/[productId].ts` — update endpoint already forwards `variations` batch to Woo
- `src/pages/api/stores/[storeId]/products/create.ts` — create endpoint needs to handle initial variation batch
- `src/components/product-edit/ImagePickerDialog.tsx` — reuse for variation image + gallery

**Two-level UX (matches reference designs):**

**Level 1 — Attributes block (variant definition):**
- List attributes with checkbox (toggle "use for variations"), attribute name, value chips
- Each attribute has an "Edit" affordance that expands inline to rename, add/remove option values, toggle "Use for variations" / "Visible on product page", delete attribute
- "+ Add new attribute" input at bottom with autocomplete from existing Woo attributes + ability to create new
- When attributes change, show a "Regenerate from attributes" action that preserves edits to existing matching variation keys

**Level 2a — Variations quick-edit table (inline per row):**
- Table columns: Options (e.g. "Ceramic / White / 150 ml"), SKU, Price, Stock, Edit (pencil icon)
- Compact row with small inputs for inline updates to SKU / regular_price / stock_quantity
- "Manage Stock" header toggle to show/hide stock column + auto-set `manage_stock: true` on edit
- Bulk actions dropdown: set regular price / sale price / stock qty / stock status / enable-disable across all or selected rows
- Checkbox column for selecting rows for bulk actions
- Drag handle to reorder (persist `menu_order` to Woo)

**Level 2b — Deep edit dialog (per variation):**
Opened via pencil icon on a row. Dialog title: "Edit {Ceramic / White / 150 ml}". Contains:
- Regular Price + Offer (sale) Price with currency suffix
- Variation Image (single) + Variation Gallery (multi) — both open ImagePickerDialog (gallery needs extension to multi-select)
- Inventory section: SKU, Quantity, Stock Status (In Stock / Out of Stock / On Backorder)
- Shipping section: Weight (kg), Dimensions (Length / Width / Height in cm)
- Description (textarea)
- Flags row: Enabled, Virtual, Downloadable, Manage Stock (checkboxes)
- Footer: Remove (left, destructive), Cancel + Save & Edit Next + Save Changes (right)
- "Save & Edit Next" advances to next variation, preserving edits in form state

**Data flow — loading existing variations:**
- When editing existing product (has `woo_id`), fetch variations via new endpoint `GET /api/stores/{storeId}/products/{productId}/variations` that pulls from Woo (or from `variations` local table if we mirror, else direct passthrough to Woo) and maps each into the `Variation` shape
- Generate composite `key` from attribute option values for matching against attribute matrix
- Store in `form.variations` so existing edits merge with regenerate output

**Data flow — creating new variations:**
- When creating a new product with `type: "variable"`, POST creates parent product first, then batch-creates variations via `POST /products/{productId}/variations/batch`
- For existing product updates, continue using the current batch update path in `[productId].ts`
- After save, refetch variations so `id` is populated on newly-created rows

**Data flow — attribute matrix regeneration:**
- Compute all combinations from attributes where `variation: true` and `options.length > 0`
- For each combination, look up existing variation by composite key — preserve all its fields (price, sku, stock, image, etc.)
- For new combinations, create blank Variation row
- For removed combinations (attribute option deleted), drop those variations (they must also be deleted from Woo on save via `delete` array in batch)
- Never discard user edits silently — if a variation was customized, retain it

**Woo API quirks to handle:**
- Variation `attributes` must use `{ id, option }` or `{ name, option }` format matching parent product attributes
- Image gallery on variations is NOT native Woo — requires `meta_data` or an addon plugin; for now store `variation_gallery` as meta_data array `{ key: "_wc_additional_variation_images", value: [imageIds] }` and document that it requires the WooCommerce Additional Variation Images plugin
- Empty price should send `""` not `null`
- `stock_quantity` only respected if `manage_stock: true`
- Bulk delete via `batch.delete: [id, id]`

**Constraints:**
- Current `VariantsTab.tsx` is 400 lines — keep under 300 by extracting VariationEditDialog, VariationRow, AttributeEditor, BulkActionsMenu into sibling files under `src/components/product-edit/variants/`
- All types live in `productEditService.ts` — extend `Variation` with `gallery?: Array<{id?: number; src: string; alt?: string}>`, `enabled?: boolean`, `virtual?: boolean`, `downloadable?: boolean`, `tax_class?: string`
- Reuse `ImagePickerDialog` — extend to support `mode: "multi"` returning array of items (it already supports single)
- Preserve existing toggle between Simple / Variable at the top

## Checklist

- [ ] Split `VariantsTab.tsx` into smaller files under `src/components/product-edit/variants/` (AttributeEditor, VariationsTable, VariationEditDialog, BulkActionsMenu) — each under 200 lines
- [ ] Attribute block: inline edit with rename, add/remove option chips, toggle "Use for variations" and "Visible", delete attribute, autocomplete from existing Woo attributes, create-new on-the-fly
- [ ] "Regenerate from attributes" button that preserves existing variation edits by composite option key and drops removed combinations
- [ ] Variations quick-edit table: Options label, SKU input, Price input, Stock input, pencil-icon to open deep edit, row-level checkbox, drag handle for reorder
- [ ] Manage Stock header toggle: shows/hides stock column and sets `manage_stock: true` when stock edited
- [ ] Bulk actions menu: apply regular price / sale price / stock qty / stock status / enable or disable to selected or all rows
- [ ] Deep edit dialog: Regular + Offer price with currency, Variation Image (single picker), Variation Gallery (multi picker), Inventory (SKU + Quantity + Stock Status), Shipping (Weight + Length + Width + Height), Description textarea, flags (Enabled / Virtual / Downloadable / Manage Stock)
- [ ] Deep edit dialog footer: Remove, Cancel, Save & Edit Next (disabled on last), Save Changes
- [ ] Load existing variations on edit: fetch from Woo via `/api/stores/{storeId}/products/{productId}/variations`, map to `Variation` shape with composite key
- [ ] New product create flow: POST parent, then batch-create variations; refetch to populate IDs
- [ ] Existing product update flow: support batch create + update + delete in single call to `products/{id}/variations/batch`
- [ ] Variation gallery persisted as `meta_data` key `_wc_additional_variation_images` (array of image IDs)
- [ ] Attribute matrix regeneration preserves existing rows by composite option-key match and removes orphaned variations (mark for delete on save)
- [ ] Empty state in variations table when no varying attributes defined — prompt user to tick "Use for variations" on at least one attribute with values
- [ ] Image picker dialog supports multi-select mode for variation gallery (extend existing component)
- [ ] Extend `Variation` type with: `gallery`, `enabled`, `virtual`, `downloadable`, `tax_class`

## Acceptance

- Opening an existing variable product loads all its variations with their current prices, SKUs, stock, and images pre-filled in the table.
- Editing a variation inline (SKU / price / stock) and hitting Save Changes persists to Woo and reloads with the new values.
- Clicking the pencil icon opens the deep edit dialog with all fields; saving updates the variation; "Save & Edit Next" moves to the next row without closing.
- Adding an option (e.g. new Size "XXL") and clicking "Regenerate from attributes" adds only the new combinations — existing edits are preserved.
- Creating a brand-new variable product with 2 attributes (Color × Size) and publishing creates the parent + all variations with per-row prices and SKUs.
- Bulk action "Set regular price to 20" updates every selected variation in one save.
- Removing a variation via the dialog's Remove button queues a delete that executes on Save Changes.