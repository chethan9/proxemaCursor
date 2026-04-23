---
title: Stream upsert in sync engine (progressive data visibility)
status: done
priority: urgent
type: bug
tags: [sync, performance, ux]
created_by: agent
created_at: 2026-04-23
position: 178
---

## Notes
Current behavior: `fetchPagesConcurrent` in `src/lib/sync-engine.ts` accumulates all pages in memory and returns the full array. Each aspect function (syncProducts/syncOrders/syncCustomers/syncCategories/syncTags/syncCoupons in `src/pages/api/stores/[storeId]/sync.ts`) then maps + batch-upserts at the end.

Result: sync_runs.records_processed counter ticks up as pages stream from Woo (via onProgress) but the DB receives NOTHING until the very end of each aspect. User sees "Orders: 1500 Running" in sync history but Orders list page shows only the 50 from prior sync.

Fix: streaming upsert — write each page batch to DB immediately as it's fetched, so data appears progressively in explorer pages.

## Checklist
- [ ] Add `onBatch?: (items: T[]) => Promise<void>` callback to `fetchPagesConcurrent` in `src/lib/sync-engine.ts` — fires after first page and after each concurrent batch completes
- [ ] Refactor syncProducts/syncOrders/syncCustomers in sync.ts to use onBatch: map rows → check existing woo_ids → upsert batch → bump created/updated counters → update sync_runs with running totals
- [ ] Move smaller aspects (categories/tags/coupons) to same pattern for consistency
- [ ] Progress counter in sync_runs should reflect rows persisted to DB, not just rows fetched from Woo
- [ ] Keep `all: T[]` return for call sites that still need the full array (variations trigger needs product IDs)
- [ ] On page fetch failure mid-aspect, already-persisted batches stay in DB (partial success is better than total loss)

## Acceptance
- Refreshing Orders page mid-sync shows orders appearing in chunks of 100-300 every few seconds
- sync_runs records_processed matches actual row count in DB at any point in time
- If network drops on page 12 of 15, pages 1-11 remain in DB (not rolled back)