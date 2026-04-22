---
title: Product + taxonomy cache invalidation after edits
status: todo
priority: high
type: bug
tags: [products, react-query, sync]
created_by: agent
created_at: 2026-04-22T15:55:00Z
position: 143
---

## Notes
Bug report Px-16, Px-19, Px-20, Px-22, Px-26. Single root cause with multiple symptoms: after editing a product (status / stock status / price / generic fields) via Edit page, Quick Edit, or renaming a category, the product list / taxonomy dropdown shows stale data until manual refresh.

**Root cause analysis:**
1. Product update API (`PUT /api/stores/[storeId]/products/[productId]`) — verify it writes back to Supabase `products` row synchronously before responding. If it only calls Woo and relies on the webhook, DB will be stale when `invalidateQueries` refetches.
2. Quick Edit invalidates `["products", storeId]` — correct pattern, but only runs if the API returned success with updated row.
3. Category rename (`PUT /api/stores/[storeId]/categories/[categoryId]`) — the Add Product category popover uses `useWooTaxonomy` which caches separately. Not invalidated when a category is edited from the Category module.

**Fix approach:**
- Ensure every product mutation API route does a synchronous Supabase UPDATE with the fresh Woo response before returning.
- Broaden invalidation on save: invalidate `["products"]`, `["product", id]`, and `["wooTaxonomy"]` where relevant.
- Status tabs (Px-16): when user changes status and the list filter matches only one status, the row should disappear from the current tab. Ensure refetch on invalidation re-applies the status filter.

## Checklist
- [ ] Audit `src/pages/api/stores/[storeId]/products/[productId].ts` — confirm it updates Supabase `products` row with fresh Woo data BEFORE returning the JSON response; if not, add the upsert
- [ ] Same audit for `create.ts` (product create) — must insert DB row synchronously, don't wait for webhook
- [ ] Same audit for `categories/[categoryId].ts` and `tags/[tagId].ts` — must update DB row synchronously
- [ ] In `ProductQuickEdit.tsx` and the Edit Product page, after save invalidate: products list key (`["products", storeId]`), the single product detail key, AND `["wooTaxonomy", storeId]` (categories/tags/brands may have been touched via bulk edits)
- [ ] In the Category / Tag edit flows (SitesTable / TaxonomyTab or wherever rename happens), invalidate `["wooTaxonomy", storeId, "categories"]` / `["wooTaxonomy", storeId, "tags"]` after save
- [ ] Verify with a screen-recording-style test: change product status from Published → Draft, list immediately removes it from Published tab without refresh

## Acceptance
- Edit product → save → list shows new values within ~1 second, no manual refresh
- Status change moves row across status tabs immediately
- Renamed category appears with new name in Add Product category picker on next open (no refresh)
- Quick Edit save reflects in the compact/grid/table views instantly
