---
title: Variable product UX issues — price range, quick edit, stock defaults
status: done
priority: high
type: bug
tags: [products, variations, quick-edit]
created_by: agent
created_at: 2026-04-26
position: 241
---

## Notes
Four UX issues for variable products:
1. Lists/cards show only the first variation price instead of the min–max range
2. Quick Edit price fields are editable for variable products (should be locked, set per-variation)
3. Stock auto-flips to "out of stock" when variation qty is empty/null
4. Quick Edit footer placed "Edit full product" too prominently next to Save

## Checklist
- [x] Add `min_price` + `max_price` columns to `products` + auto-recompute trigger on `product_variations`
- [x] Backfill min/max for existing variable products from variations
- [x] ProductsTab grid card shows range "KWD 10.00–25.00" for variable products
- [x] ProductsTab compact card shows range
- [x] Table "price" column shows range
- [x] ProductRowExpanded shows price range pill
- [x] ProductQuickEdit disables Regular/Sale price for variable type with helper note
- [x] ProductQuickEdit footer: "Edit full product" promoted to outline button on the left
- [x] VariationsTable inline qty disabled when manage_stock off, no auto-flip on empty input, preserves onbackorder
- [x] VariationEditDialog same: empty qty preserves status, qty input disabled when manage_stock off

## Acceptance
- Variable product cards/rows show "KWD 10.00–25.00" instead of a single price
- Quick Edit on a variable product locks price fields with explanation
- Variation with manage_stock off and no qty stays "in stock"
- Quick Edit footer: "Edit full product" on the left, Cancel + Save on the right