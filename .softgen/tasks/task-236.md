---
title: Variant bulk update accepts sale price higher than regular price
status: todo
priority: medium
type: bug
tags: [products, variations, validation, ux]
created_by: agent
created_at: 2026-04-26
position: 236
---

## Notes

User reports: in the Variants tab → Bulk actions menu, applying a sale price doesn't validate against each row's regular price. Sale > regular is silently accepted, producing nonsense pricing on the storefront.

### Where it lives

`src/components/product-edit/variants/VariationsTable.tsx` — bulk actions handler. The bulk apply path calls `applyBulk(patch, onlySelected, selectedKeys)` in `VariantsTab.tsx`, which spreads the patch over each variation. There's no per-row check that the new sale price is < that row's existing regular price.

### Fix direction

Two-layer validation:

1. **Inline at the bulk dialog**: before applying, evaluate the patch against each affected row. Collect rows where `sale_price >= regular_price` (after the patch). If any exist, show a confirmation/blocker: "3 variations would have sale price ≥ regular price. These will be skipped." Either skip those rows or block the entire apply — pick one (suggest: block, with a clear message listing the offending rows).
2. **Per-row inline editing**: the price input cells in the variations table also need this guard. When the user types a sale price > regular in the inline cell, show a red border + tooltip and prevent the save (or just visually warn — block at the form-level validate when publishing).

The single-variation edit dialog (`VariationEditDialog.tsx`) likely has its own sale-vs-regular guard already; mirror that logic into the bulk path.

## Checklist

- [ ] In `VariationsTable.tsx` (or wherever the bulk dialog handler lives — confirm by reading the file), before calling `applyBulk` with a `sale_price` patch, compute affected variations and check each one's effective regular price (existing or in-patch) against the new sale price.
- [ ] If any rows fail the check, show an inline error in the bulk dialog listing the offending variation labels (e.g. "Red, Green: sale price would exceed regular price"). Block the apply until user fixes.
- [ ] Add the same guard at form-level in `productValidation.ts::validateProductForm` for variations: when publishing a variable product, any variation with `sale_price > 0 && sale_price >= regular_price` is a validation error.
- [ ] Add the inline cell warning in the variations table: red border on the sale price cell when the value is invalid against that row's regular price. Non-blocking visual cue; the form-level validation gates the actual save.
- [ ] Test: bulk-set sale price to 999 across 3 variations priced 33 each. Bulk dialog should block with a clear message. Manually setting one row's sale to 50 (regular 33) inline shows red. Hitting Save blocks with a validation error pointing to that row.

## Acceptance

- Bulk-applying a sale price greater than or equal to the regular price of any affected row blocks the apply with a clear error.
- Inline typing of an invalid sale price visually flags the cell.
- Save/publish blocks when any variation has sale ≥ regular.