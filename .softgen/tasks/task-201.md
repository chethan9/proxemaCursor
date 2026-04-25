---
title: Sync engine resilience — orphan parent recovery + deadlock retry
status: done
priority: urgent
type: bug
tags: [sync, reliability, deadlock]
created_by: agent
created_at: 2026-04-25T23:00:00Z
position: 201
---

## Notes

Two production bugs surfaced together:

1. **Stuck "All" parent run at 100%** — `sync_runs` row with `aspect='all'` stayed in `running` status after every child aspect settled. The `useActiveSync` hook then keeps showing the progress banner, which locks the Products page from filtering/pagination. Root cause: when a chunked aspect resume invocation drops mid-flight (cron heartbeat already bumped, fire-and-forget fetch never returns), the completion check in `src/pages/api/stores/[storeId]/sync.ts` that finalizes the parent never runs. SQL one-shot was applied to clear the current stuck run; needed a permanent recovery path.

2. **Customers upsert deadlock (`40P01`)** — `src/lib/sync-engine.ts` ran `fetchPagesChunked` with concurrency 4. Four parallel page upserts into `customers` with overlapping `(store_id, woo_id)` keys deadlocked under Postgres lock acquisition order. Showed up as a failed sync run with `customers upsert failed: deadlock detected`. Cron-resumed it later and it succeeded, but the failure left noise + contributed to the orphan parent.

## Checklist

- [x] `auto-fail-stuck` cron now recovers orphan "All" parent runs: queries `sync_runs` where `aspect='all'` AND `status='running'`; for each, checks if any non-`all` child started after parent is still running; if none → marks parent completed
- [x] After recovering an orphan parent, unlocks the store: if no other `running` runs exist for that store, flips `stores.status` from `syncing` to `connected` and bumps `last_sync_at`
- [x] Wrapped the `upsert` call inside `persistAndCheckpoint` (sync.ts) in a retry loop: detects Postgres deadlock (`40P01`) and serialization failure (`40001`), retries up to 3 times with jittered exponential backoff (200ms × 2^attempt + jitter)
- [x] Lowered `fetchPagesChunked` default `concurrency` from 4 to 2 in `src/lib/sync-engine.ts`
- [x] Returns the new recovery counter from auto-fail-stuck handler so cron logs surface it

## Acceptance

- A stuck-at-100% sync auto-recovers within one cron cycle (≤5 min) without manual SQL
- Customers/orders/products parallel-page upserts no longer surface `deadlock detected` failures during initial sync
- The Sync Engine UI never gets stuck in "Syncing 100%" while every aspect row shows Completed/Failed