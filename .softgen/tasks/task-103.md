---
title: Live WooCommerce fallback during initial sync
status: done
priority: high
type: feature
tags: [sync, ux, woocommerce]
created_by: agent
created_at: 2026-04-21T03:00:00Z
position: 103
---

## Notes

Problem: Until initial sync completes, the Products/Orders/Categories/Tags tabs show "No products found". Users have to wait 5–30 minutes on large stores before they can see anything. Screenshot: `beam` store synced but tab renders empty state during sync.

Solution: When `stores.initial_sync_completed_at IS NULL`, fetch directly from the WooCommerce REST API in the data services as a fallback. Once initial sync completes, automatically switch to the Postgres mirror (faster, searchable, filterable).

### Design
- New helper `src/lib/woo-live-fetch.ts`: typed fetch wrapper for `products`, `orders`, `products/categories`, `products/tags` using store credentials. Accepts same filters/pagination as the Postgres queries (page, per_page, search, status, category, stock_status, orderby/order).
- New API routes (server-side, uses service-role credentials safely):
  - `GET /api/stores/[storeId]/live/products`
  - `GET /api/stores/[storeId]/live/orders`
  - `GET /api/stores/[storeId]/live/categories`
  - `GET /api/stores/[storeId]/live/tags`
  Each accepts filter/pagination query params, forwards to Woo, returns `{ data, count }` matching the existing service shape. Enforces permission check against the store.
- Update each service (`productService.ts`, `orderService.ts`, `taxonomyService.ts`) to accept an `initialSyncDone: boolean` flag. When `false`, call the `/live/*` endpoint instead of Supabase. When `true`, use existing Postgres query.
- Update hooks (`useProducts`, `useOrders`, `useTaxonomy`) to read `initial_sync_completed_at` from the store record and pass the flag through. Cache the store-level flag via a new `useStoreSyncStatus(storeId)` hook to avoid re-fetching on every tab.
- Add a thin "Live mode" badge in the table toolbar while live-fetching so users understand data is coming from WooCommerce directly (slightly slower, can't filter server-side across huge datasets).
- When `useActiveSync` detects `running: true → false`, also invalidate the `storeSyncStatus` query so tabs flip to DB mode automatically.

### Constraints
- Live fetch is per-request (no caching) — WooCommerce API is slow. Show a small loader next to the "Live mode" badge.
- Filters that Woo doesn't support natively (e.g. price range) should be applied client-side on the returned page only, with a note "Filters may be limited during initial sync."
- Pagination respects Woo's `per_page` max of 100. If user requests pageSize > 100, clamp and disable larger page sizes while in live mode.
- CSV export from live mode only exports the current page (we'd hammer the API otherwise) — show a tooltip explaining this.

## Checklist

- [ ] New helper `src/lib/woo-live-fetch.ts` with typed wrappers for products/orders/categories/tags including pagination, search, status filter
- [ ] New API routes under `src/pages/api/stores/[storeId]/live/*.ts` (products, orders, categories, tags) that authenticate the user, fetch from Woo, return `{ data, count }` shape identical to service returns
- [ ] `productService.fetchProducts` accepts `mode: "db" | "live"` and routes to live API when mode is live
- [ ] `orderService.fetchOrders` accepts `mode: "db" | "live"` similarly
- [ ] `taxonomyService` fetch functions for categories and tags accept `mode` flag similarly
- [ ] New hook `useStoreSyncStatus(storeId)` returns `{ initialSyncDone, isLoading }` by reading `stores.initial_sync_completed_at`
- [ ] `useProducts`, `useOrders`, `useTaxonomy` call `useStoreSyncStatus` and pass the derived mode into their service calls
- [ ] "Live mode" visual indicator in ProductsTab, OrdersTab, TaxonomyTab toolbar while mode is live (small badge: "Live from WooCommerce" with spinning dot)
- [ ] Clamp pageSize options to ≤100 while in live mode, add tooltip explaining the limit
- [ ] CSV export button tooltip changes to "Exports current page only during live mode" while in live mode
- [ ] When `useActiveSync` detects completion, invalidate `useStoreSyncStatus` query so tables auto-switch to DB mode without reload
- [ ] Verify: fresh store with sync in progress shows real products immediately; after sync completes, switches to DB mode silently; page/filter/search work in both modes

## Acceptance

- On a fresh site where sync is still running, Products/Orders/Categories/Tags tabs show real WooCommerce data (not empty state) within 2s of opening the tab.
- A small "Live mode" badge appears in the toolbar while fetching from WooCommerce.
- When initial sync completes, the tabs silently switch to the Postgres mirror — no reload needed.
- Pagination, basic search, and status filters work in live mode (with pageSize clamped to 100).