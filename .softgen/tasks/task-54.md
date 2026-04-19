---
title: Bulk jobs progress toast + history page
status: done
priority: high
type: feature
tags: [bulk-ops, ui, realtime]
created_by: agent
created_at: 2026-04-19
position: 54
---

## Notes
Two UX pieces for tracking bulk jobs:

**1. Floating progress toast** (global) — bottom-right corner, persists across page navigation. Shows active jobs with progress bar. Minimizable. Survives browser refresh (reads active jobs from DB on app mount).

**2. Bulk jobs history page** `/sites/[id]/bulk-jobs` — table of all jobs for the site with status, progress, counts, errors viewer, cancel button (if running), retry failed button (if completed with errors).

Progress updates: Supabase Realtime subscription on bulk_jobs table filtered by user's accessible stores. Fallback: poll every 3s if realtime fails.

Toast states:
- Running: spinner + progress bar + "X/Y updated"
- Completed clean: green check + "150 orders updated"
- Completed with errors: yellow warning + "148/150 updated • 2 failed" + "View errors" link
- Failed: red X + error message + retry button
- Cancelled: grey + "Cancelled by user"

Auto-dismiss completed toasts after 10s. Failed/error toasts stay until manually dismissed.

## Checklist
- [ ] Create `src/contexts/BulkJobsProvider.tsx`: tracks active jobs (Map<jobId, BulkJob>), subscribes to Realtime on mount, provides addActiveJob, dismissJob, activeJobs
- [ ] On mount: fetch jobs where status IN (running, pending) for user's stores → seed activeJobs
- [ ] Wrap _app.tsx with BulkJobsProvider (after AuthProvider)
- [ ] Create `src/components/bulk/BulkJobsToast.tsx`: fixed bottom-right Card, renders one row per active job with progress bar, close button (dismiss from view, not cancel), click row to expand details
- [ ] Render BulkJobsToast in AppLayout so it shows on every authenticated page
- [ ] Create `src/pages/sites/[id]/bulk-jobs.tsx`: table with Job type, Status badge, Progress (N/M), Started at, Duration, Errors count, Actions (cancel/retry/view errors)
- [ ] Create `src/components/bulk/BulkJobErrorsDialog.tsx`: shows errors[] array with order_id + error message per row, copy-to-clipboard JSON
- [ ] Wire Cancel action: bulkJobService.cancelJob → worker picks up cancelled status on next batch check
- [ ] Wire Retry action: creates new job with payload filtered to only failed order_ids
- [ ] Add "Bulk Jobs" link to site sidebar nav (when sites secondary sidebar exists; for now add to existing site settings page quick links)
- [ ] Add unread badge count to BulkJobsToast header when minimized showing count of running jobs
- [ ] check_for_errors