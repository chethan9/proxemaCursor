---
title: Live-API-first rendering with background sync + cache warming
status: done
priority: high
type: feature
tags: [sync, live-api, cache]
created_by: agent
created_at: 2026-04-21T03:52:00Z
position: 108
---

## Notes

Current behavior: on first paint of a fresh site, Products/Orders/Categories tabs show "Syncing your products…" until DB is populated. User can't do anything until sync finishes.

Desired: on first visit (no DB data yet), immediately fetch via live WooCommerce API → render instantly → in background, sync pipeline writes same data to DB → on next visit, DB path is used (fast, searchable, filterable). Live API results from first visit should also be **warm-written to DB and to React Query cache**, so the background sync doesn't re-fetch what we already have.

### Current state (verified)
- `useProducts` already has `useLive` flag (`src/hooks/queries/useProducts.ts`) that switches between Supabase and `/api/stores/:id/live/products`
- Same for `useOrders`, `useTaxonomy` categories/tags
- Live endpoints exist at `src/pages/api/stores/[storeId]/live/*.ts`
- `useLive` auto-activates when `initialSyncDone === false`

### Gaps
1. Live API result is **not written to DB** — every visit hits WooCommerce directly, wasting rate limit
2. Live API result is **not seeded into React Query cache for the non-live key** — when sync completes and hook switches to DB mode, cache is empty (see task-106)
3. Filters/search/sort behavior differs between live and DB mode — user sees inconsistency
4. No visible indicator that user is seeing "live API data" vs "cached DB data"
5. **Background sync doesn't start until user visits the site page** — the ~10s window while user reviews WordPress app-password / clicks through OAuth confirmation is wasted. Sync should kick off the moment credentials are saved.

### Eager sync on credential save
- **OAuth callback** (`api/woocommerce/callback.ts`): after saving WC consumer key/secret, immediately fire-and-forget a call to `/api/stores/[storeId]/sync-start` for the fast aspects (categories, tags, first page of products). Don't await — let it run in background while user finishes WP app-password flow.
- **WP app-password callback** (`api/wordpress/app-password-callback.ts`): on credential save, kick off the full sync pipeline (all aspects) in background. User is still on the "connecting…" screen for several seconds — use that time.
- **Webhook registration step** (`api/stores/[storeId]/register-webhooks.ts`): already runs — ensure it doesn't block sync.
- By the time user reaches Products page, initial sync is often already 30-80% done → DB-mode works immediately, no live fallback needed.
- If live fallback is still needed (huge catalog), the warm-write + cache bridge from above handles the transition smoothly.

### Fix strategy
- **Warm-write live results to DB**: live endpoint upserts fetched rows into `products`/`orders`/etc tables with a `source='live_fetch'` marker. Next DB query returns them. Concurrent sync run dedupes by `woo_id` on upsert.
- **Seed React Query cache**: when live hook returns data, `queryClient.setQueryData` for the corresponding DB query key so mode-switch is seamless.
- **Unified filter semantics**: document in service layer that live mode supports {search, status, stock_status, price range, sort} — anything else forces DB mode with a "filter requires initial sync" hint.
- **Subtle indicator**: small dot/badge "Live from WooCommerce" when in live mode, disappears once DB is primary.

### Constraints
- Live mode pagination must match WooCommerce's (page+1 offset) — already handled in `fetchProducts`
- Upsert-on-live-read must be safe with concurrent sync (use `ON CONFLICT DO UPDATE` on `(store_id, woo_id)` unique constraint)
- Don't warm-write if background sync is actively writing the same rows (check `sync_runs` status, skip upsert if aspect is `running`)

## Checklist

- [ ] Add upsert step to live endpoints (`api/stores/[storeId]/live/products.ts` + orders/categories/tags): after fetching from WooCommerce, upsert rows into corresponding Supabase table
- [ ] Use `source` / `synced_at` columns so warm-written rows are distinguishable from full-sync rows
- [ ] Skip warm-write when a sync run for that aspect is currently `running` (avoid write contention)
- [ ] In `useProducts`/`useOrders`/`useTaxonomy`: on live-mode success, call `queryClient.setQueryData` for the DB-mode query key with the same payload (sync cache bridge)
- [ ] Add "Live" badge component shown in tab header while `useLive === true` with tooltip "Showing live data from WooCommerce. Initial sync in progress."
- [ ] Update Products/Orders/Taxonomy tabs to not show "Syncing…" empty state when live data has loaded (check already done in ProductsTab; verify OrdersTab and TaxonomyTab match)
- [ ] **Eager sync trigger**: OAuth callback fires fast-aspect sync (categories/tags/first page products) immediately after saving WC keys — fire-and-forget, no await
- [ ] **Full sync trigger**: WordPress app-password callback kicks off full sync pipeline in background when user is still on loading screen
- [ ] Ensure sync-start endpoint is idempotent (safe to call twice, picks up where it left off)
- [ ] Verify: complete OAuth → before WP step done, check sync_runs table shows `running` or `completed` rows for categories/tags
- [ ] Verify: fresh site → Products loads via API in <2s → DB populated in background → reload → same products from DB with no re-fetch flash

## Acceptance

- On first visit to a fresh site, Products/Orders/Categories/Tags show real data within 2s via live API.
- Data from live API is persisted to DB so subsequent visits are instant (DB-mode).
- No "Syncing your products…" empty state when live data is available.
- Mode switch (live → DB) is invisible to the user; no empty flash.
- **Initial sync is already running (or completed) by the time user first lands on the site's Products page** — leveraging the OAuth + WP app-password review windows.