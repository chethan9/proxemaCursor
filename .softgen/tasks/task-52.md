---
title: Bulk jobs worker cron with 2x parallel processing
status: todo
priority: urgent
type: feature
tags: [bulk-ops, cron, worker]
created_by: agent
created_at: 2026-04-19
position: 52
---

## Notes
Background worker that processes bulk_jobs. Runs as Vercel cron every 10 seconds. Picks up pending jobs, processes in batches, saves progress, exits before Vercel timeout so next tick continues.

Pattern mirrors existing `/api/cron/sync-scheduler.ts`. Uses CRON_SECRET bearer auth.

Concurrency: 2 parallel WooCommerce requests per batch (p-limit or Promise.all chunks). Batch size ~40 orders per run (fits in 60s with safety margin).

Resumability: worker reads `processed` count, skips already-done items in payload.order_ids[processed...].

Cancellation check: before each batch, re-read job row; if status=cancelled, exit cleanly.

Manual testing: add `/api/dev/trigger-bulk-worker` that calls same handler bypassing cron auth in dev only (guard with NODE_ENV check).

## Checklist
- [ ] Add vercel.json cron entry: path `/api/cron/process-bulk-jobs` schedule `*/10 * * * * *` (every 10s — verify Vercel supports sub-minute; if not, use `* * * * *` = every minute)
- [ ] Create `src/pages/api/cron/process-bulk-jobs.ts`: verify CRON_SECRET bearer, SELECT pending/running jobs ordered by created_at, lock with status=running + started_at
- [ ] Implement job dispatcher: switch on job_type → processUpdateOrderStatus / processDeleteOrders
- [ ] Implement batch processor: slice payload.order_ids from processed index, chunk by 2 concurrent, Promise.all each chunk, await all, update processed/succeeded/failed/errors after each chunk
- [ ] On WooCommerce error per item: push {order_id, error} to errors array, increment failed, continue
- [ ] Before each batch: re-fetch job row, if status=cancelled exit. If time elapsed > 50s, exit (let next cron tick continue)
- [ ] On full completion: set status=completed, completed_at=now(), push realtime notification
- [ ] Use supabase admin client (service role) to bypass RLS for cron
- [ ] Log structured events: `[bulk-jobs] jobId=X type=Y batch=N/M succeeded=A failed=B`
- [ ] Create `src/pages/api/dev/trigger-bulk-worker.ts`: dev-only (return 404 if NODE_ENV=production), calls same processor inline — for manual testing
- [ ] Auto-fail stuck jobs: in existing `auto-fail-stuck.ts` cron, add bulk_jobs check: status=running + started_at < now - 30min → set failed
- [ ] check_for_errors