---
title: Optimize sync engine (dedup, parallel, incremental, retry)
status: done
priority: urgent
type: feature
tags: [sync, performance, woocommerce]
created_by: agent
created_at: 2026-04-23
position: 177
---

## Notes
Overhaul sync pipeline after site connection:
1. Dedup sync triggers — 3 places currently fire sync-start (callback.ts, wp-callback, connect page), causing 3× concurrent runs
2. Parallel phased execution — main aspects run in parallel with concurrent page fetching (2 pages in flight per aspect)
3. Incremental mode — use `modified_after` filter from `last_sync_at` for subsequent syncs (10-20× speedup); weekly full reconciliation via `last_full_sync_at`
4. Variations last + non-blocking — runs in dedicated endpoint fired after main phases complete so "all" row closes without waiting
5. Robust retry — exponential backoff on 429/5xx/network, honors Retry-After, per-page max 3 attempts

## Checklist
- [x] Add `stores.last_full_sync_at` column via migration
- [x] Update `sync-start.ts`: skip creating new run if one running <5min old
- [x] Create `src/lib/sync-engine.ts`: fetchWooWithRetry + fetchPagesConcurrent with X-WP-TotalPages discovery
- [x] Rewrite `sync.ts`: main aspects parallel, close "all" row before variations, fire-and-forget variations
- [x] Create `sync-variations.ts`: dedicated endpoint for parent-by-parent variation sync
- [x] Incremental mode: modified_after from last_sync_at; weekly full reconciliation when last_full_sync_at >7 days
- [x] Retry: 3 attempts, expo backoff, honor Retry-After, distinguish retryable vs non-retryable

## Acceptance
- Adding a new site triggers exactly ONE "all" sync run
- Main aspects complete faster (parallel aspects + parallel pages)
- Second manual sync on a connected store finishes quickly (incremental mode)
- Variations continue syncing after "all" marks complete
- Transient network failures retry transparently instead of failing the whole run