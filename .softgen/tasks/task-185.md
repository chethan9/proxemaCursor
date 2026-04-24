---
title: Product stock toggle persistence
status: todo
priority: high
type: bug
tags: [product, stock]
created_by: agent
created_at: 2026-04-24
position: 185
---

## Notes
**Bugs Px-38 and Px-38-1.** Track/Manage Stock toggle is not retained after saving.

- Px-38: Add Product (Basic and Advanced) — publish with Track Stock on + quantity; reopen Edit → toggle is off, but quantity reappears when toggled back on.
- Px-38-1: Quick Edit — enable Manage Stock + set qty, save; reopen full Edit → toggle off.

Verified the WooCommerce payload does include `manage_stock` (`src/services/productEditService.ts`, `src/pages/api/stores/[storeId]/products/create.ts`, `[productId].ts`). Bug is in one of: (a) the local DB mirror not persisting `manage_stock`, (b) the GET/load flow dropping the flag, (c) the form initializer defaulting `manage_stock` to `false` even when `stock_quantity` is set.

Affected files: `src/services/productEditService.ts` (form load/save), `src/pages/api/stores/[storeId]/products/[productId].ts` (GET + PUT DB update), `src/components/explore/ProductQuickEdit.tsx`, `src/components/product-edit/BasicEditor.tsx`.

## Checklist
- [ ] Verify `products.manage_stock` column is written on every product create and update (both basic and advanced, both full edit and quick edit)
- [ ] Ensure GET product endpoint returns `manage_stock` and the form loader hydrates `form.manage_stock` from the response
- [ ] In Quick Edit, confirm the PUT payload always includes `manage_stock` (not just when user toggled it)
- [ ] Fix variant-level `manage_stock` persistence as well (VariationEditDialog)
- [ ] After fix: create → reopen → edit → reopen → toggle stays correct across all flows
- [ ] Add regression console log for the GET response to confirm the flag round-trips

## Acceptance
- Save a product with Track Stock on + qty 20, reopen — toggle remains on, qty 20 visible
- Same behavior for Advanced editor and Quick Edit
- Saving with Track Stock off does not silently set qty