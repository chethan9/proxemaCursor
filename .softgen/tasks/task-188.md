---
title: Free product appears in list immediately after publish
status: todo
priority: high
type: bug
tags: [product, list, sync]
created_by: agent
created_at: 2026-04-24
position: 188
---

## Notes
**Bug Px-17.** Publishing a product with "Free Product" selected pushes successfully to WooCommerce and appears on the storefront, but does NOT show in the Proxema product list immediately. After a page refresh it's still missing; only appears after a delay (sync cycle).

Hypothesis: after publish we redirect to the list, but the list query is either:
1. Not invalidated, so React Query serves cached data without the new row
2. Invalidated, but the create endpoint doesn't insert the local DB mirror row for free products (filter on `regular_price > 0` somewhere)
3. Inserted but with a status that the default list filter ("All") excludes

Affected files: `src/pages/api/stores/[storeId]/products/create.ts`, `src/services/productEditService.ts`, `src/components/explore/ProductsTab.tsx`, `src/hooks/queries/useProducts.ts`.

## Checklist
- [ ] Trace: publish a free product, then check `products` table directly — is the row inserted?
- [ ] If row missing: remove any `regular_price > 0` filter from the insert path; ensure free products (price "0" or "") are mirrored
- [ ] Ensure React Query invalidates `products` list key on successful publish
- [ ] Ensure optimistic insert or router navigation includes a refetch trigger
- [ ] Verify the default "All" tab and category filter don't exclude price=0 rows
- [ ] Add console log on publish success showing the new product ID + the refetch trigger

## Acceptance
- Publishing a free product navigates to the list and the product is visible within 1 second (no manual refresh, no sync wait)