---
title: Multi-site concurrent sync support + fix site-switch freeze
status: done
priority: urgent
type: feature
tags: [sync, ui, bug, multi-site]
created_by: agent
created_at: 2026-04-19
position: 0
---

## Notes

Two tightly-coupled issues:
1. **Bug:** Switching sites during an active sync on site A freezes the UI.
2. **Feature gap:** Banner only tracks the current URL's storeId. If user connects 2-3 sites in quick succession, all sync in parallel (backend supports this — verified: `sync-scheduler.ts` loops stores independently, `sync.ts` running-status checks are per-`store_id`) but user only sees whichever site they're viewing. The others are invisible.

### Root cause of freeze (in `src/components/SyncProgressBanner.tsx`)

Banner state (`prevRunningRef`, `displayProgress`, `overlayOpen`, `cardOpen`) isn't scoped to `storeId`. When URL changes from site A to site B:
1. `useActiveSync(storeId)` switches to site B's query → `data.running` flips `true` (A) → `false` (B).
2. Completion-detection effect fires `prevRunningRef.current && !data.running` → thinks site B just completed. Triggers toast + mass query invalidation + deletes site A's progress localStorage key.
3. Mass invalidation plus site A's still-running 2-second polls = refetch storm → UI locks.

### Architectural change: track ALL active syncs, not just current store's

**New hook: `useAllActiveSyncs()`** in `src/hooks/queries/useAllActiveSyncs.ts`
- Query `sync_runs` for all rows where `aspect = 'all'` AND `status = 'running'` AND `started_at > now() - 15 min`, joined with `stores` so we get `{ id, name, url }` per active sync.
- RLS already scopes stores to the current user's client(s).
- Polls every 2s, returns `ActiveSync[]` shape: `{ store_id, store_name, store_url, progress, current_aspect, elapsed_seconds, processed, is_initial, started_at }`.
- Compute progress per-row using the same weight map from `useActiveSync` (orders 45, products 25, customers 20, categories 4, tags 3, coupons 3).

### Banner redesign

**Banner location:** Already in `AppLayout` — it renders on every page via `SyncProgressBanner`. Good. No routing change.

**Rendering logic:**
- `activeSyncs.length === 0` → render nothing (still return celebration dialog shell for transitions).
- `activeSyncs.length === 1` → current full-width banner. If the one active sync's `store_id === currentUrlStoreId` → show current detailed banner (progress bar, rocket, message, elapsed, %). If the one active sync is for a DIFFERENT store → show compact row with site icon + name + "Syncing · Orders · 23%" + Go-to-site arrow button. Clicking navigates to `/sites/${store_id}/products`.
- `activeSyncs.length >= 2` → stacked compact rows (each row = site icon + name + mini bar + aspect + % + navigate arrow). Up to 3 rows visible. If >3, collapse extras into "+N more syncing" row that expands on click.

**Mini compact row design:** roughly 36px tall, site icon (20px), site name (truncate), small 2px-tall progress bar (w-40), aspect label (w-20 truncate), %, navigate arrow. Same emerald/green styling, no rocket/message in compact mode.

### State scoping fix (also resolves freeze)

Instead of one `displayProgress` + `prevRunning` pair, use a `Map<storeId, { displayProgress, prevRunning }>` ref. When rendering the detailed (current-site) banner, look up that store's entry. Completion-detection runs per-storeId, firing its own toast/celebration when THAT specific store transitions `running → false`.

Celebration dialog fires ONLY when:
- The completed store's `store_id === currentUrlStoreId` (user is viewing that site), AND
- `is_initial === true`, AND
- `celebrated:${store_id}` localStorage flag not set.

Non-current-site completions show a toast with `Todoo sync complete — 124 records · 2m 14s [Go →]` (clickable to navigate). Still invalidates all store-scoped queries so if user happens to be looking at that store's data, it refreshes.

### Files

- `src/hooks/queries/useAllActiveSyncs.ts` — NEW multi-store query hook
- `src/components/SyncProgressBanner.tsx` — rewrite: use `useAllActiveSyncs`, per-store state map, compact vs full row rendering, multi-row stacking
- `src/components/SyncCompactRow.tsx` — NEW small row component for non-current or multi-site mode
- `src/hooks/queries/useActiveSync.ts` — may be deprecated or kept as single-store convenience wrapper

## Checklist

- [ ] New hook `useAllActiveSyncs` queries running `sync_runs` joined with `stores`, returns array of per-store progress with same weight map, polls every 2s
- [ ] New `SyncCompactRow` component: site icon, site name (truncate), mini progress bar, aspect + % text, arrow button to navigate to that site's products page
- [ ] Banner renders nothing when 0 active syncs
- [ ] Banner renders full-detail mode (progress bar, rocket, message, elapsed) ONLY when 1 active sync AND it matches current URL storeId
- [ ] Banner renders compact row mode when 1 active sync for a DIFFERENT store than current URL
- [ ] Banner renders stacked compact rows (up to 3) when 2+ active syncs; "+N more syncing" collapse row if >3
- [ ] Per-store state map replaces single `prevRunningRef`/`displayProgress` — completion-detection keyed by store_id, no spurious firing on site switch
- [ ] Celebration dialog fires only for current-site initial-sync completions; background completions show toast with site name and click-to-navigate action
- [ ] All completions (current or background) invalidate `["orders"]`, `["products"]`, `["taxonomy"]`, `["webhooks"]`, `["sync-runs"]` query prefixes
- [ ] localStorage progress persistence keyed per `storeId` as before (`sync-display-progress:${storeId}`)

## Acceptance

- Connecting 2-3 sites in quick succession: banner shows a stacked row for each site syncing, with correct progress, aspect, and %.
- Switching sites mid-sync never freezes the UI — banner continues showing all active syncs.
- User on site A while site B also syncing: sees site A's detailed banner on top (or compact row if A isn't syncing) + compact row for B below. Clicking B's row navigates to B's products page.
- Only 1 sync running, not current URL's site: banner shows a compact row for that site (user can click to go there).
- Initial-sync celebration dialog fires only when user is on the site that just finished its initial sync. Other site completions show a clickable toast.
- No spurious completion toasts or celebration dialogs triggered by site navigation.