---
title: Upgrade sync-runs page with cache, pagination, filters, CSV export
status: todo
priority: high
type: feature
tags: [logs, performance]
created_by: agent
created_at: 2026-04-18
position: 44
---

## Notes
Current `src/pages/sync-runs/index.tsx` (655 lines) uses direct Supabase calls. Migrate to React Query + useBackgroundPagination pattern from PAGE_CONVENTIONS.md.

Filters to add:
- Site (dropdown of all sites user has access to)
- Status (pending, running, success, failed, partial)
- Trigger type (manual, webhook, cron, initial)
- Date range (last 24h / 7d / 30d / custom)
- Free-text search on site name / error message
- Aspect (products/orders/customers/categories/tags/coupons)

CSV export: current filtered result, all columns (id, site, aspect, status, trigger, started_at, finished_at, duration, records_processed, error).

Use `useSyncRuns` hook (already exists) — extend with filter params if needed.
Apply debounced search, pagination with total count, idle background prefetch (cap 5000), `isLoading` shimmer.

File split: extract SyncRunFilters.tsx, SyncRunsTable.tsx, SyncRunDetailPanel.tsx.

## Checklist
- [ ] Extend useSyncRuns to accept filter params (site, status, trigger, date range, search, aspect)
- [ ] Create src/components/sync-runs/SyncRunFilters.tsx
- [ ] Create src/components/sync-runs/SyncRunsTable.tsx
- [ ] Create src/components/sync-runs/SyncRunDetailPanel.tsx
- [ ] Rewrite src/pages/sync-runs/index.tsx (<300 lines) using hooks pattern
- [ ] Wire useBackgroundPagination (maxRecords 5000, resetKey from filters)
- [ ] Wire CSV export via shared ExportButton
- [ ] check_for_errors