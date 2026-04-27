---
title: Remove bulk-jobs toast + scope jobs/downloads to current user
status: done
priority: high
type: bug
tags: [bulk-jobs, downloads, multi-user, ux]
created_by: agent
created_at: 2026-04-27T05:00:00Z
position: 239
---

## Notes

Two related issues with the bulk-jobs / downloads layer:

### 1. Remove the floating bulk-jobs toast
The `BulkJobsToast` widget (bottom-right floating panel showing running jobs + progress) is causing UX problems — duplicated state with the proper Bulk Jobs page, gets in the way of other UI, and re-mounts unexpectedly. Remove it from the app entirely. Keep the file in the repo for now (don't delete it) so it can be reinstated later if needed, but unmount it from `src/pages/_app.tsx`. The dedicated Bulk Jobs page (`src/pages/sites/[id]/bulk-jobs.tsx`) and Downloads page remain the source of truth for users to see their jobs.

### 2. Scope bulk_jobs + downloads to the current user
Today, multiple operators on the same site see each other's running jobs and download files. That's wrong — each user should only see what they themselves enqueued. The `bulk_jobs` table already has `user_id` (set on insert in `createBulkJob` at `src/services/bulkJobService.ts`). The list/query endpoints just don't filter by it.

**Queries to add `user_id = auth.uid()` filter to:**
- `listBulkJobs(storeId)` — `src/services/bulkJobService.ts`
- `listActiveBulkJobs()` — same file
- The completed-print-jobs query in `src/hooks/queries/useBulkJobs.ts`
- `listSiteDownloads(storeId)` — `src/services/downloadsService.ts`

Pattern: at the top of each function, call `supabase.auth.getUser()`, grab `data.user?.id`, and add `.eq("user_id", uid)` to the query. If no user (shouldn't happen on protected pages), return empty array.

**Backfill consideration:** old rows that have `user_id = null` (from before user_id was tracked) will now disappear from everyone's view. That's acceptable — those are stale anyway. No DB migration needed.

**Don't break:** the cron worker (`src/pages/api/cron/process-bulk-jobs.ts`) uses `supabaseAdmin` and processes ALL pending jobs regardless of user — leave it alone. Only client-side LIST queries get scoped.

## Checklist

- [ ] Remove `<BulkJobsToast />` mount + import from `src/pages/_app.tsx`. Leave the component file in place.
- [ ] Add `user_id = auth.uid()` filter to `listBulkJobs` and `listActiveBulkJobs` in `src/services/bulkJobService.ts`.
- [ ] Add same filter to the completed-print-jobs query in `src/hooks/queries/useBulkJobs.ts` (the `useRecentCompletedPrintJobs` hook or equivalent).
- [ ] Add same filter to `listSiteDownloads` in `src/services/downloadsService.ts`.
- [ ] Verify `src/pages/sites/[id]/bulk-jobs.tsx` and `src/pages/sites/[id]/downloads.tsx` now show only the current user's items (no other code change needed — they consume the scoped queries).
- [ ] Verify cron worker still processes all jobs (it uses `supabaseAdmin` so the auth filter doesn't apply).

## Acceptance

- The floating bulk-jobs toast is gone from every page.
- User A enqueues a bulk delete; User B (same site, different account) does not see User A's job in the bulk-jobs page or downloads page.
- The cron continues to process pending jobs from all users normally.