---
title: Invalidate data queries when initial sync completes
status: done
priority: high
type: bug
tags: [react-query, sync, cache]
created_by: agent
created_at: 2026-04-21T03:45:00Z
position: 106
---

## Notes

Symptom: after initial sync finishes (DB has 122 products, `stores.initial_sync_done=true`), the Products/Orders/Categories/Tags tables stay empty until a hard refresh.

Root cause: `useProducts` / `useOrders` / `useTaxonomy` cache the "live API fallback" result under the same query key used when sync is in progress. When `initialSyncDone` flips `false → true`, the hook switches `useLive` to `false` but React Query still serves the previous cached payload for that store — which was produced from the live API (possibly empty or stale) and never gets refetched because nothing invalidates it.

### Evidence in current code
- `src/hooks/queries/useProducts.ts` line ~11: `queryKey: [...queryKeys.products(opts.storeId, opts as Record…), useLive] as const` — appending `useLive` to the key **does** make it a new query, but the UI keeps rendering the old `products=[]` from the previous key because `placeholderData: keepPreviousData` carries it forward and the new query hasn't been fetched yet (enabled only flips when `syncStatus !== undefined`).
- Same pattern in `useOrders`, `useTaxonomy`.
- No listener invalidates these queries when sync completes.

### Fix
- In `useStoreSyncStatus` (or a new hook `useSyncCompletionInvalidation`), watch the `initial_sync_done` value. When it transitions `false → true` for a given `storeId`, call:
  - `queryClient.invalidateQueries({ queryKey: queryKeys.products(storeId) })`
  - `queryClient.invalidateQueries({ queryKey: queryKeys.orders(storeId) })`
  - `queryClient.invalidateQueries({ queryKey: ["taxonomy", "categories", storeId] })`
  - `queryClient.invalidateQueries({ queryKey: ["taxonomy", "tags", storeId] })`
- Use a ref/map to track previous value per storeId so it only fires on transition, not on every refetch.
- Place the watcher in `AppLayout` or a top-level site-scoped effect so it runs once per session per store.

### Also
- In `ProductsTab` / `OrdersTab`, when the `initialSyncBanner` disappears (sync done), trigger a one-shot `refetch()` of the current query too — belt-and-braces against the cache staleness.

## Checklist

- [ ] Create hook `useSyncCompletionInvalidation` in `src/hooks/queries/` that subscribes to per-store `initial_sync_done` via `useStoreSyncStatus` and invalidates products/orders/categories/tags queries on false→true transition
- [ ] Wire the hook into `SiteLayout` so it's active whenever a site page is open
- [ ] In `ProductsTab`, `OrdersTab`, `TaxonomyTab`: call `refetch()` once when `initialSyncDone` flips true (via effect watching the same status)
- [ ] Verify: start a fresh store sync → watch products page → when banner disappears, products appear automatically without refresh

## Acceptance

- When initial sync completes, Products / Orders / Categories / Tags pages populate within 2s without needing a manual refresh.
- No duplicate refetches during normal operation (only fires on the transition).