---
title: Chunked resumable sync engine
status: in_progress
priority: urgent
type: feature
tags: [sync, infrastructure, reliability]
created_by: agent
created_at: 2026-04-25T21:00:00Z
position: 1
---

## Notes
Replace the current "one-shot, fail-on-timeout" sync model with a **chunked, cursor-based, resumable** engine driven by the existing sync-scheduler cron. Solves: timeouts on large stores, lost progress on crashes, Vercel 5-min function ceiling on production tier, future support for very large stores (50k+ products/orders).

**Architecture:**
- Each aspect (products/orders/customers/etc) is a state machine in `sync_runs` with `cursor_page` + `last_heartbeat_at`.
- One invocation processes up to `MAX_PAGES_PER_INVOCATION` (default 10 pages × 100 records = 1,000 records) then exits — leaves status=`running` if more pages remain.
- `sync-scheduler` cron (runs every minute) detects running syncs with stale heartbeat (>60s old) and re-invokes `/api/stores/:id/sync?aspect=X&resume=true` to continue from `cursor_page`.
- `auto-fail-stuck` only fails truly dead runs — heartbeat stale >90min, not `started_at` based.
- Sync engine already idempotent (upserts on `(store_id, woo_id)`) so restarts are safe.

**Why this works:** Vercel function limit is per-invocation, not per-sync. Splitting one 30-min sync into 30 × 1-min invocations stays well under any limit and survives crashes/deploys.

## Checklist
- [x] DB migration: add `cursor_page`, `last_heartbeat_at`, `total_pages` to `sync_runs`
- [ ] `src/lib/sync-engine.ts`: add `fetchPagesChunked()` that accepts `startPage` + `maxPages`, returns `{lastPage, hasMore, totalPages}`, calls `onBatch` per page batch with heartbeat update
- [ ] `src/pages/api/stores/[storeId]/sync.ts`: per-aspect `runAspect` reads existing run's `cursor_page`, processes up to MAX_PAGES, writes new cursor + heartbeat, exits with status=`running` if `hasMore` else `completed`. Support `resume=true` query param to continue an existing run instead of creating new.
- [ ] `src/pages/api/cron/sync-scheduler.ts`: in addition to scheduled syncs, detect `sync_runs` where status=`running` AND `last_heartbeat_at` < now-60s — re-invoke sync.ts with `resume=true&aspect=X` for each
- [ ] `src/pages/api/cron/auto-fail-stuck.ts`: switch from `started_at` to `last_heartbeat_at` threshold (90 min of no heartbeat = truly dead)
- [ ] Sanity test: trigger sync on a large store, verify it chunks across multiple invocations, completes without 30-min timeout

## Acceptance
- A sync on a 10k-order store completes successfully even though no single invocation runs longer than ~2 minutes
- Killing a sync mid-run (manual cancel + restart, or deploy interruption) resumes from the last completed page, not from page 1
- Stuck syncs (heartbeat dead >90min) are auto-failed; merely-slow syncs are not