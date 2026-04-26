---
title: Add-new advanced product parity with edit + SKU optional
status: done
priority: high
type: bug
tags: [products, add-new, variants, parity, sku]
created_by: agent
created_at: 2026-04-26T10:00:00Z
position: 215
---

## Notes

Two related issues with the advanced product editor:

### 1. SKU should not be mandatory
Currently `src/services/productValidation.ts` enforces SKU on publish:
```
if (publishing) {
  if (!trim(form.sku)) errors.push({ field: "sku", message: "SKU is required" });
}
```
And `src/components/product-edit/tabs/InventoryShippingTab.tsx` renders `<Label required>SKU</Label>`. WooCommerce itself does not require SKU. Make it optional everywhere — drop the required guard, drop the asterisk on the label. Variation SKUs should already be optional (verify).

### 2. Add-new advanced product is missing fields/sections that exist in edit advanced

**Reference (working):** `src/pages/sites/[id]/products/edit/[productId].tsx` — Edit Advanced shows full Basics + Inventory + Variants with attribute chips, "Regenerate from attributes" button, full variations table with Options/SKU/Price/Sale/Stock columns, bulk actions, auto-fill SKUs, refresh from WooCommerce.

**Broken (missing):** `src/pages/sites/[id]/products/new.tsx` — Add new Advanced renders only the bare attribute input on the Variants tab. No guidance, no variations preview, no bulk actions, no "Regenerate" until something is typed. Other tabs may also be sparser than edit.

Root cause hypothesis: `VariantsTab` ties feature visibility to `productId` being present. For new products, productId is null until first save, so server-side fetches and most affordances stay hidden. The fix is to render the full UI from the form state (which is local) rather than gating on a saved productId, and only gate the network-bound parts (refresh from WC, auto-fill from server) — not the local-state-driven parts (regenerate combinations, edit rows, bulk actions).

Files to compare and align:
- `src/pages/sites/[id]/products/new.tsx` vs `src/pages/sites/[id]/products/edit/[productId].tsx`
- `src/components/product-edit/AdvancedShell.tsx` (shared shell — confirm both pages pass identical tabs/props)
- `src/components/product-edit/tabs/VariantsTab.tsx`
- `src/components/product-edit/tabs/BasicInfoTab.tsx`
- `src/components/product-edit/tabs/InventoryShippingTab.tsx`
- `src/components/product-edit/tabs/PricingTaxTab.tsx`
- `src/components/product-edit/variants/VariationsTable.tsx`
- `src/components/product-edit/variants/AttributeEditor.tsx`

Acceptance evidence: open `/sites/[id]/products/new` in Advanced mode — Variants tab should show the same attribute chip UI, "Regenerate from attributes" button, variations table with all columns, bulk actions menu, auto-fill SKUs button (refresh-from-WC button can be hidden until first save). Switching between new and edit should feel identical except for the Save vs Publish button.

## Checklist

- [ ] Drop SKU required validation in `productValidation.ts` (parent and variations) — publish without SKU should succeed
- [ ] Remove the `required` flag on the SKU label in `InventoryShippingTab.tsx` (and any variation SKU label)
- [ ] Side-by-side audit: list every visual element on edit Advanced (each tab) that is missing, hidden, or styled differently on new Advanced. Use the two attached screenshots as the spec.
- [ ] Refactor `VariantsTab.tsx` so the full UI (attribute editor, regenerate button, variations table, bulk actions, auto-fill SKUs) renders for both new and existing products — only gate the WooCommerce-network features (refresh from WC, server-side variation fetch) on `productId`
- [ ] Confirm Basics tab parity: same fields, layout, helper text, image picker on both new and edit
- [ ] Confirm Inventory tab parity: same fields, same stock toggles, same shipping/tax sections
- [ ] Verify Publish flow on new advanced: enter name → add Size attribute with XS/S/M → mark "Use for variations" → Regenerate → set prices on each variation → Publish. Should create the parent + all variations in WooCommerce in one save.
- [ ] Verify Save flow on edit advanced still works after refactor (no regression)

## Acceptance

- Publishing a product without SKU succeeds; no "SKU is required" error.
- `/sites/[id]/products/new` (Advanced mode) Variants tab is visually and functionally indistinguishable from `/sites/[id]/products/edit/[productId]` (Advanced mode) Variants tab on a fresh product before save.
- A new variable product can be created end-to-end (parent + variations) from the new product page without bouncing to edit.

