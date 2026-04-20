---
title: Unified onboarding + bulletproof sync celebration
status: done
priority: urgent
type: feature
tags: [sync, onboarding, realtime, celebration]
created_by: agent
created_at: 2026-04-20
position: 85
---

## Notes

Fixing five compounding issues so first-time sync always completes visibly.

**Root causes (verified against code):**
1. `stores` + `sync_runs` likely not in `supabase_realtime` publication → `SyncCelebrationWatcher` subscribes but receives zero events → no live confetti, no auto-refresh of data pages
2. Manual-keys flow (`AddSiteDialog.triggerInitialSync`) calls `/api/stores/{id}/sync` directly, bypassing `/sync-start` → no `is_initial=true` placeholder row → celebration can never fire for manually-connected stores
3. Connect wizard layout overflows small screens (6 step rows + large liftoff card stacked vertically, min-h-[60vh])
4. Data tabs show "No X found" during initial sync — users don't realize sync is still populating
5. Even with realtime fixed, backgrounded tabs may drop WebSocket → need visibility/focus fallback

**Files touched:**
- SQL: add both tables to `supabase_realtime` publication
- `src/components/project/AddSiteDialog.tsx` — remove `triggerInitialSync`, redirect manual flow to wizard
- `src/pages/sites/connect/[id].tsx` — handle `manual=1` query param, compact layout
- `src/pages/api/stores/[storeId]/sync.ts` — safety-net stamp on `initial_sync_completed_at` when first `all` run completes (even without `is_initial` flag)
- `src/components/SyncCelebrationWatcher.tsx` — add `visibilitychange` re-poll, add periodic fallback poll every 30s
- `src/components/explore/TaxonomyTab.tsx`, `src/components/explore/OrdersTab.tsx`, `src/components/explore/ProductsTab.tsx` — sync-aware empty state
- `src/hooks/queries/useOrders.ts`, `useProducts.ts`, `useTaxonomy.ts` — enable `refetchOnWindowFocus`

## Checklist

- [ ] Enable realtime on `stores` and `sync_runs` tables via `ALTER PUBLICATION supabase_realtime ADD TABLE`
- [ ] Manual-keys path in add-site dialog: on create, redirect to connect wizard with `?success=1&manual=1` instead of closing + silent sync trigger
- [ ] Connect wizard handles `manual=1` param: skip OAuth polling, skip "Authorizing with WooCommerce" + "Receiving API credentials" steps (mark them done immediately), proceed to WP authorization
- [ ] Connect wizard compact layout: reduce card padding, condense step list to single-line rows with smaller icons, show only relevant steps per stage (collapse completed steps into a summary bar), replace step list with liftoff card in-place at liftoff stage — must fit in ~600px viewport height
- [ ] Sync API safety net: when closing the "all" placeholder row, also stamp `stores.initial_sync_completed_at` if it's null AND this is the first completed `all` run for that store (regardless of `is_initial` flag) — ensures manually-connected stores celebrate
- [ ] Celebration watcher resilience: add `document.visibilitychange` listener that re-fetches pending celebrations when tab becomes visible; add 30-second fallback polling interval as backup for realtime drop
- [ ] Celebration watcher also invalidates data queries (orders, products, taxonomy) whenever a store's `initial_sync_completed_at` transitions from null to set — guarantees auto-load without manual refresh
- [ ] Sync-aware empty state on Tags, Categories, Orders, Products tabs: when `useAllActiveSyncs` shows current store syncing, replace "No X found" with spinner + "Syncing your {aspect}… ({X}%)" + "New items will appear automatically as they arrive"
- [ ] Enable `refetchOnWindowFocus: true` on orders/products/taxonomy query hooks so returning to a tab forces fresh data
- [ ] **Celebration dedup fix:** stamp `stores.celebration_shown_at` at enqueue time (not on dialog close) — prevents re-showing confetti on refresh/navigation if user dismisses by clicking outside or navigates away mid-animation. Also filter out already-stamped rows in realtime handler to handle cross-tab races. Current behavior: confetti fires every projects-page visit because stamp only happens on explicit close.
- [ ] Sidebar sync percentage continues working (already shipped, verify unchanged)

## Acceptance

- Adding a site via manual keys produces the same wizard experience as OAuth (WP auth → estimate → liftoff → celebration)
- Initial sync completion triggers confetti within 3 seconds, whether user is on any page or returns to the tab after sync finished while backgrounded
- Orders/Products/Tags pages auto-populate when sync completes — zero manual refresh needed
- Connect wizard fits in a laptop viewport (~700px) without scrolling at any stage