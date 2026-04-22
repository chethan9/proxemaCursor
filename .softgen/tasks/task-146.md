---
title: Free product visible in panel + category filter + count
status: todo
priority: high
type: bug
tags: [products, filters, sync]
created_by: agent
created_at: 2026-04-22T15:55:00Z
position: 146
---

## Notes
Three related bugs about the panel not reflecting Woo data correctly.

- **Px-17 (free product missing from panel list)**: Likely cause — `POST /api/stores/[storeId]/products/create` creates in Woo but relies on the webhook to insert the DB row. Free products (price=0) may trigger a different webhook payload or the webhook may be delayed/dropped. Also verify no fetchProducts filter is silently excluding price=0 or empty-price rows.
- **Px-18 (category filter empty)**: In `productService.ts` `fetchProducts`: `.ilike("categories::text", '%"name":"${categoryFilter}"%')`. The jsonb-to-text cast in Postgres may format as `{"name": "Skin Care", ...}` with spaces between key and value — the ilike pattern `"name":"Skin Care"` (no space) then misses. Replace with a jsonb containment query or filter by category id.
- **Px-28 (category product count stale)**: The count column in the `categories` table is synced from Woo's `count`. Woo recalculates lazily so immediately after creating a product, count may still be 0. Fix: after product create/update that touches categories, trigger a light refetch of affected categories from Woo, OR compute a fallback "local count" by joining `products.categories` in the Category List query.

## Checklist
- [ ] Audit `/api/stores/[storeId]/products/create.ts`: after the Woo POST returns, synchronously INSERT the full row into Supabase `products` (don't wait for webhook); return the created DB row to the caller
- [ ] Verify no price/stock filter in `fetchProducts` silently excludes free (price=0) products; test Px-17 scenario after fix
- [ ] Rewrite the category filter in `fetchProducts` to use jsonb containment: `.contains("categories", [{ name: categoryFilter }])` and/or prefer filtering by category id (switch `categoryOptions` to return `{id, name}` tuples)
- [ ] Update `useProductCategoryOptions` to surface both id and name so the filter value is an id, not a display string
- [ ] For Px-28: after successful product create/update, invalidate `["wooTaxonomy", storeId, "categories"]` AND re-fetch the `categories` count for the affected category ids from Woo (one GET per touched category), updating Supabase
- [ ] Optional fallback: in `fetchCategories` add a computed `local_product_count` from `products.categories @> [{id: cat.id}]` and display it when Woo `count` is 0 but local > 0

## Acceptance
- Create a free product → it appears in panel Product List within ~1s
- Select a category in the panel filter → products with that category are listed correctly (tested with a category whose name contains a space)
- Assign a product to a new category → Category module shows count = 1 without manual refresh
