---
title: Product + taxonomy cache invalidation after edits
status: done
priority: high
type: bug
tags: [products, taxonomy, react-query]
created_by: agent
created_at: 2026-04-22T15:56:00Z
position: 143
---

## Notes
Bug report Px-16, Px-19, Px-20, Px-22, Px-26. After edits, lists or dropdowns show stale values until manual refresh.

Investigation showed product list invalidation already works (ProductsTab passes a prefix-matching key `["products", storeId]`). The remaining broken case is Px-26: Add Product's category/tag dropdown uses `useWooTaxonomy` with key `["woo", "taxonomy", storeId, kind]`, and `TaxonomyRowExpanded` only invalidated `queryKeys.taxonomy(...)` — different key, different cache.

## Checklist
- [x] In `TaxonomyRowExpanded.tsx` also invalidate `["woo", "taxonomy", storeId, mode]` after save + delete
- [x] Verify ProductQuickEdit `onSaved` callback in `ProductsTab.tsx` invalidates `["products", storeId]` (confirmed — already prefix-matching)
- [x] Verify product update API PUT returns the refreshed DB row (confirmed in `pages/api/stores/[storeId]/products/[productId].ts`)

## Acceptance
- Rename a category → open Add Product → category appears in picker on next open (no refresh)
- Quick Edit save reflects in the compact/grid/table views instantly
