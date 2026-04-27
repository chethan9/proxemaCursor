---
title: Brands management page (mirror Categories)
status: done
priority: high
type: feature
tags: [brands, taxonomy, woocommerce]
created_by: agent
created_at: 2026-04-27T12:55:00Z
position: 246
---

## Notes

Add a full Brands management surface under `/sites/[id]/brands` that mirrors the existing Categories page exactly: list view with search, server-side pagination, sortable columns, quick-edit row expansion, "Add new" dialog, and live two-way sync with the WooCommerce store (native WC brands taxonomy at `/wp-json/wc/v3/products/brands`).

Brand sync from Woo → mirror is already wired (DB table, sync engine aspect, brand pills on cards). Outstanding: management UI + Woo write-back for create/update/delete from our app.

The existing `TaxonomyTab` / `TaxonomyDialog` / `TaxonomyRowExpanded` are already parameterised by `mode: "categories" | "tags"` — extend the union to include `"brands"` rather than duplicating components.

Files to extend: `src/services/taxonomyService.ts`, `src/hooks/queries/useTaxonomy.ts`, `src/components/explore/TaxonomyTab.tsx`, `src/components/explore/TaxonomyDialog.tsx`, `src/components/explore/TaxonomyRowExpanded.tsx`, `src/components/layout/SiteSidebar.tsx`, `src/lib/menu-merge.ts` (default tree).

Files to create: `src/pages/sites/[id]/brands.tsx`, `src/pages/api/stores/[storeId]/brands/create.ts`, `src/pages/api/stores/[storeId]/brands/[brandId].ts`.

Brands are a flat taxonomy (no parent), so omit any parent picker UI from the dialog when `mode === "brands"` — same as `tags`.

## Checklist

- [ ] Extend `taxonomyService.ts` with `fetchBrands`, `createBrand`, `updateBrand`, `deleteBrand` mirroring the tag functions (no parent param)
- [ ] Extend `useTaxonomyRows` hook to accept `"brands"` and call `fetchBrands`
- [ ] Extend `TaxonomyTab`, `TaxonomyDialog`, `TaxonomyRowExpanded` mode union to include `"brands"` with singular label "brand" and an appropriate icon (e.g. `Bookmark` or `Award` from lucide-react)
- [ ] Create `/api/stores/[storeId]/brands/create` POST endpoint that calls Woo `POST products/brands` then upserts into mirror `brands` table
- [ ] Create `/api/stores/[storeId]/brands/[brandId]` PUT + DELETE endpoint that calls Woo `PUT/DELETE products/brands/{wooId}` then updates/removes from mirror
- [ ] Create `/sites/[id]/brands` page using `SitePageShell` + `TaxonomyTab` with `mode="brands"` (mirror of `categories.tsx`)
- [ ] Add "Brands" item to default site menu tree in `buildInitialSiteTree` (`src/lib/menu-merge.ts`) right under "Tags" with the same icon used in the tab
- [ ] Add brand prefetch branch in `SiteSidebar` hover prefetch (route regex + queryClient.prefetchQuery for brands)
- [ ] All endpoints log success/failure to `webhook_events` (or `activity_log` per app convention) so admin can see which brand mutation hit Woo
- [ ] Empty state, loading skeleton, search debounce, sort by name/count/created_at — all behave identically to Categories tab (already handled by the shared component once mode is added)

## Acceptance

- Visiting `/sites/{id}/brands` shows the synced brand list with search and pagination working identically to Categories
- Clicking a row expands a quick-edit panel; saving updates the brand in WooCommerce and refreshes the row
- "Add new brand" dialog creates a brand in Woo and it appears in the list without a manual sync
- Deleting a brand from the row panel removes it from Woo and the mirror
- The new "Brands" sidebar item navigates to the page, prefetches data on hover, and is hidden if the user lacks `manage_products` permission (same gate as Categories)