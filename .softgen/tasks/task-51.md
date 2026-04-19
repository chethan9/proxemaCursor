---
title: Bulk jobs foundation - schema, service, types
status: done
priority: urgent
type: feature
tags: [bulk-ops, database, infra]
created_by: agent
created_at: 2026-04-19
position: 51
---

## Notes
Foundation for all bulk operations. Creates the `bulk_jobs` table that tracks long-running background jobs (bulk order status updates, bulk deletes, bulk product edits). Worker cron and UI both depend on this.

Schema must support: multiple job types, progress tracking, error collection per-item, cancellation, user/store scoping.

Job types for v1: `update_order_status`, `delete_orders`. Products come in task-55.

RLS: users see jobs for their clients' stores (same pattern as sync_runs). Service role bypasses for worker.

## Checklist
- [ ] Create `bulk_jobs` table via execute_sql_query: id uuid PK, store_id FK, user_id FK, job_type text, payload jsonb, status text (pending/running/completed/failed/cancelled), total int, processed int, succeeded int, failed int, errors jsonb default '[]', started_at, completed_at, created_at, updated_at
- [ ] Add CHECK constraint on status values and job_type values
- [ ] Add index on (status, created_at) for worker pickup, (store_id, created_at desc) for history
- [ ] Enable RLS; add SELECT policy scoped to user's clients via stores->clients->client_users join
- [ ] Add INSERT policy for authenticated users on their stores
- [ ] Add UPDATE policy for cancellation (set status=cancelled by owner)
- [ ] Generate types via supabase_generate_types
- [ ] Create `src/services/bulkJobService.ts` with: createJob, getJob, listJobs(storeId), cancelJob, subscribeToJob (realtime channel for progress)
- [ ] Export TypeScript types: BulkJobType, BulkJobStatus, BulkJobPayload (discriminated union per job_type)