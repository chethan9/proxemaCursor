---
title: Split explore mega-page into 4 per-site pages (products/orders/tags/categories)
status: done
priority: high
type: feature
tags: [site-pages, refactor, routing]
created_by: agent
created_at: 2026-04-18T15:30:00Z
position: 36
---

## Notes
Split `src/pages/explore/[id].tsx` (1267 lines) into 4 separate sub-pages under `/sites/[id]/` — one per tab (Products/Orders/Tags/Categories). Each page keeps ALL existing features: filters, sort, view modes, column customization, CSV export, row expand panels, quick edit, pagination, search.

Existing `src/components/explore/` components are already modular and reusable:
- `OrdersTab.tsx` — fully self-contained
- `TaxonomyTab.tsx` — handles both tags and categories via `mode` prop
- Row-expand + quick-edit components per entity

Main extraction effort: Products tab UI lives inline in explore page (~600 lines of JSX). Extract into new `src/components/explore/ProductsTab.tsx` component so sites/products.tsx can use it cleanly.

**Non-impact guarantee:** No changes to global sidebar, main nav, settings, services, DB, explore components. Only file replacements on sites/[id]/{products,orders,tags,categories}.tsx (currently placeholders) and extraction of Products logic.

Site sidebar already has items linking to these routes — they're rendered in `src/lib/menu-registry.ts` SITE_MENU_REGISTRY.

Legacy `/explore/[id]` page keeps working (redirects to /sites/[id]).

## Checklist
- [ ] Extract Products UI from `src/pages/explore/[id].tsx` into `src/components/explore/ProductsTab.tsx`: receives `storeId`, `storeUrl`, optional initial search; contains all filter/sort/view/column/export/pagination state and UI; preserves localStorage keys (`explore-page-size`, `explore-view-mode`, `explore-col-order`) and viewPreferences save
- [ ] Rewrite `src/pages/sites/[id]/products.tsx`: SitePageShell + header (back arrow, site name/URL) + search input + `<ProductsTab />`; load store via `getStore`; skeleton + not-found states
- [ ] Rewrite `src/pages/sites/[id]/orders.tsx`: SitePageShell + header + search input + `<OrdersTab storeId storeUrl search />`
- [ ] Rewrite `src/pages/sites/[id]/tags.tsx`: SitePageShell + header + search input + `<TaxonomyTab mode="tags" storeId search />`
- [ ] Rewrite `src/pages/sites/[id]/categories.tsx`: SitePageShell + header + search input + `<TaxonomyTab mode="categories" storeId search />`
- [ ] Extract a tiny `SiteSectionHeader` helper inside `_shared.tsx` with back arrow + site name/URL + centered search input — reused by all 4 pages for consistency
- [ ] Verify `/explore/[id]` redirect still works (no change needed, but confirm) and sidebar items navigate correctly
- [ ] Run check_for_errors; fix TS errors from the extraction
- [ ] Confirm no other files touched (git diff should show only the planned files + new ProductsTab.tsx)