---
title: Sync engine resilience for large stores + accurate counts + pagination
status: todo
priority: urgent
type: bug
tags: [sync, sync-engine, live-preview, pagination, ux, data-explorer]
created_by: agent
created_at: 2026-04-26T13:30:00Z
position: 216
---

## Notes

Multi-part operational reliability fix for stores with 5k+ products / 30k+ orders / 100k+ customers. User spent 90+ minutes watching a "successful" sync get auto-failed, locking the site in live-preview despite 24k+ orders, 11k+ customers, and 1k+ products having been written. Root causes identified — refs below.

### Root cause 1: Heartbeat threshold too tight for large stores
- `src/pages/api/cron/auto-fail-stuck.ts` lines 20–48: any run whose `last_heartbeat_at` is older than `HEARTBEAT_DEAD_MINUTES` is auto-failed. For a 30k-order paginated sync, individual page batches plus DB upserts can exceed the threshold while real progress is being made.
- Effect seen: parent "All" run failed at 3036 created records with message `Auto-failed: heartbeat dead for 90+ minutes`, even though child Orders/Customers runs were still genuinely running.
- The auto-fail also marks the parent failed, which surfaces as a sync error → keeps `stores.is_initial_sync_pending = true` → site stays in live-preview lock.

### Root cause 2: Stat counts on Sync Engine + Data tabs are stale
- `src/pages/projects/[id].tsx` line 301 — `totalRecords` and the per-aspect tiles (0 Orders, 0 Customers) are sourced from `dataCounts`, which appears to come from the *latest sync run snapshot*, not from `count(*)` against `products / orders / customers / customer_addresses` tables for this `store_id`.
- Effect: top tiles say "0 Orders" while the Orders table renders 24k+ rows below. Same on the Data tab card stats vs the table that shows real rows.
- Fix: replace stat cards with live `count` queries against the mirror tables (one cheap `head: true` count per aspect, cached in React Query for 30s).

### Root cause 3: "Syncing… 100%" UI stuck
- Progress bar hits 100% as soon as the last aspect's pagination completes, but the parent run row hasn't flipped to `completed` yet (post-processing: variation prefetch, address backfill, run-row UPDATE). User reads "100% Syncing…" as broken.
- Fix: when computed progress >= 99% and `status === "running"`, render label as **"Finalizing…"** instead of "Syncing…". Keep "Syncing…" only while progress < 99%.

### Root cause 4: Site lock doesn't release on partial success
- Site stays in live-preview lock as long as `is_initial_sync_pending = true`. Currently only flipped to false on a fully successful "All" run. If the parent gets auto-failed but children completed, the flag never flips.
- Fix: when a parent "All" run is auto-failed, before marking the run failed check whether each per-aspect child run for the same window is `completed` — if products + orders + customers + categories + tags + coupons all succeeded, mark the parent `completed` instead of `failed` and unlock the store.
- Additionally: even on a true failure, if at least products + categories completed, downgrade lock to "operational with warnings" (banner stays but edits unlock for synced aspects).

### Root cause 5: No pagination on Sync Engine history + Data tab tables
- `src/pages/projects/[id].tsx` Sync History renders all runs (15+ rows visible, can grow to thousands).
- `src/pages/sites/[id]/orders.tsx` orders table on Data tab needs server-side pagination already wired but card stats above mislead.
- Fix: cap Sync History to last 25, with "Load more" → +25, and a "View all" link to `/sync-runs?storeId=...`. Confirm Data tab tables (Products / Orders / Customers / Categories / Tags) all use server-side paging with rows-per-page selector and never fetch all rows at once.

### Heartbeat threshold tuning
- Bump `HEARTBEAT_DEAD_MINUTES` for parent "All" runs to **180 minutes** (3h). Per-aspect runs stay at current threshold.
- Sync engine workers must heartbeat at the START of every page fetch, every batch DB upsert, AND once per minute via a setInterval inside long-running aspect handlers. Reference: `src/lib/sync-engine.ts`, `src/pages/api/stores/[storeId]/sync.ts`.
- Auto-fail-stuck job should also skip parents that have any child run with `last_heartbeat_at` within the last 30 min — i.e. parent isn't dead if children are alive.

## Checklist

- [ ] Heartbeat coverage: instrument `src/lib/sync-engine.ts` so every paginated WC fetch + every batch upsert touches `sync_runs.last_heartbeat_at`. Add a 60s setInterval guard inside the long-running aspect loop that pings the parent run row.
- [ ] Auto-fail-stuck rework (`src/pages/api/cron/auto-fail-stuck.ts`): split heartbeat threshold per run kind — parent "All" runs use 180 min, per-aspect runs use 90 min. Skip parent runs that have any active child run heartbeated within 30 min.
- [ ] Partial-success rescue: before failing a parent "All" run in auto-fail-stuck, look up child runs for the same window. If all critical aspects (products, orders, customers, categories, tags, coupons) have a `completed` run, flip the parent to `completed` and emit `info_message` "Recovered after parent heartbeat timeout" instead of failing.
- [ ] On any successful parent run completion, set `stores.is_initial_sync_pending = false`. Keep this behavior for the partial-success rescue path too.
- [ ] Stat tiles on Sync Engine page (`src/pages/projects/[id].tsx`): replace `dataCounts` snapshot reads with live counts. Add `useSiteLiveCounts(storeId)` hook returning `{ products, orders, customers, categories, tags, coupons }` from `select('id', { count: 'exact', head: true })` against each mirror table, refetch every 30s, also invalidate when active sync run changes status. Reference for query pattern: `src/services/siteStatsService.ts`.
- [ ] Same live-counts hook used on Data tab top stat cards so card numbers match the table that follows.
- [ ] Progress label transition (`src/components/project/SyncPanel.tsx` or wherever the "Syncing…" / progress bar lives — search for the literal "Syncing"): when `status === 'running' && progress >= 99` show **"Finalizing…"**; when `progress >= 99 && elapsed > 5min` show **"Finalizing — wrapping up post-processing…"** with a subtle spinner.
- [ ] Sync History on `/projects/[id]` capped to 25 rows by default. "Load more" appends +25. "View all sync runs →" link to `/sync-runs?storeId={id}`.
- [ ] Sync History row count badge on the section header reflects total run count for this store, not just visible rows.
- [ ] Confirm Data tab Orders/Customers/Products/Categories/Tags tables all use server-side pagination (page + pageSize params, no full-table fetch). For any tab still doing `range(0, 9999)`, switch to paged with default pageSize 50.
- [ ] Live preview banner copy: when partial success has been rescued, banner switches from "Initial import in progress" to "Initial import complete — some background tasks still running" with green tint, and edit affordances unlock.
- [ ] Sync engine top tiles get a small "live" pulse dot when active sync is running so user sees counts will keep climbing.
- [ ] Surface `info_message` on the All Sync Details modal next to Error Message when a run was rescued or had non-fatal warnings (e.g. "Recovered after parent heartbeat timeout").

## Acceptance

- For a store mid-sync with 24k+ orders already written, the Sync Engine top tiles show the live mirror counts (>0 for Orders, >0 for Customers) — never 0 when DB has rows.
- Data tab stat cards match the row count in the table directly below them, both during sync and after.
- A parent "All" run whose per-aspect children have all completed is marked `completed` (not `failed`) by auto-fail-stuck, and the site exits live-preview lock automatically.
- Sync History on a busy store shows max 25 rows with a "Load more" button, page does not freeze on stores with hundreds of runs.
- Progress bar sitting at 100% for >5 seconds reads "Finalizing…" not "Syncing…".
