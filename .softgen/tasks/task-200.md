---
title: Loading feedback polish for data tables and detail pages
status: todo
priority: high
type: feature
tags: [ux, loading, polish]
created_by: agent
created_at: 2026-04-25T22:00:00Z
position: 200
---

## Notes

Two distinct loading states needed across data-heavy surfaces:

1. **First load (no data yet)** — skeleton shimmers that match the row/card shape so users see structure immediately.
2. **Refetch with existing data** — when the user changes filter, sort, search, or paginates on a list that already has rows, the table currently freezes for 1-3 seconds with no feedback. Need a small centered loading widget (spinner + subtle backdrop) overlaid on the table so the user knows their action was registered. Old data stays visible underneath (already handled by react-query's `keepPreviousData`).

**Technical context:**
- React Query already exposes `isLoading` (first load only) and `isFetching` (any refetch). The new overlay should show when `isFetching && !isLoading && data exists`.
- All listed list pages already use `keepPreviousData` via `useProducts` / `useOrders` / `useCustomers` / `useTaxonomyRows` — old rows stay visible during refetch, which is exactly what we want.
- A single reusable overlay component should be built and dropped into each list's table card.

**Surfaces needing skeleton shimmers (first load):**
- Products list (table view) and grid/compact view — `src/components/explore/ProductsTab.tsx`
- Product edit page — `src/pages/sites/[id]/products/edit/[productId].tsx`
- Orders list — `src/components/explore/OrdersTab.tsx`
- Order detail page — `src/pages/sites/[id]/orders/[orderId].tsx`
- Customers list — `src/pages/sites/[id]/customers.tsx`
- Customer edit/detail page — `src/pages/sites/[id]/customers/[customerId].tsx`
- Categories/Tags list — `src/components/explore/TaxonomyTab.tsx`

**Surfaces needing the refetch overlay spinner:**
- Same list pages above (Products, Orders, Customers, Categories, Tags) — overlay covers the table card body when `isFetching` fires from filter/sort/search/pagination.

## Checklist

- [ ] Reusable refetch overlay component: small centered spinner with label like "Updating…", semi-transparent backdrop over the parent container, fades in/out smoothly, positioned absolutely so it doesn't shift layout
- [ ] Wire the overlay into Products list (both table and grid/compact views) — show when refetching with existing data
- [ ] Wire the overlay into Orders list table — show during filter/sort/pagination refetches
- [ ] Wire the overlay into Customers list table — show during filter/sort/pagination refetches
- [ ] Wire the overlay into Categories list table — show during filter/sort/pagination refetches
- [ ] Wire the overlay into Tags list table — show during filter/sort/pagination refetches
- [ ] Audit Product edit page — replace any plain spinner with skeleton matching the form layout (image area, fields, tabs)
- [ ] Audit Order detail page — replace plain spinner with skeleton matching the order layout (header, line items table, customer panel, totals)
- [ ] Audit Customer detail/edit page — replace plain spinner with skeleton matching the customer layout (avatar, contact fields, orders list)
- [ ] Verify existing list-page shimmers (Products table, Products grid/compact, Orders, Customers, Categories, Tags) match their final row/card shapes — refine if any look generic or jarring

## Acceptance

- Switching filters or pages on a list with existing rows shows a small centered "Updating…" spinner over the table within ~100ms; previous rows stay visible.
- Opening Product/Order/Customer edit pages for the first time shows a skeleton that mirrors the final layout, not a blank screen or generic spinner.
- First load of any list page (no cached data) shows row-shaped shimmer placeholders, then transitions smoothly to real data.