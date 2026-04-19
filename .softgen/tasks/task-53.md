---
title: Orders bulk actions - selection UI, confirm modal, job submit
status: todo
priority: high
type: feature
tags: [bulk-ops, orders, ui]
created_by: agent
created_at: 2026-04-19
position: 53
---

## Notes
Add bulk selection to OrdersTab. Checkboxes per row + select-all header checkbox. When 1+ rows selected, show bulk action bar above the table with count and action dropdown.

Actions v1: Mark as Completed, Mark as Processing, Mark as On Hold, Mark as Cancelled, Delete orders.

Confirm modal explains async behavior: "This will update 150 orders via WooCommerce API. It runs in the background — you can close this page. Estimated time: 3-5 minutes."

On submit: call bulkJobService.createJob, close modal, show progress toast (toast logic in task-54). Optimistic UI not appropriate here since job is async — just clear selection and surface the toast.

Selection resets on: page change, filter change, search change, tab change.

## Checklist
- [ ] Add selection state to OrdersTab: `selectedIds: Set<string>`, handleToggle, handleToggleAll, clearSelection
- [ ] Add Checkbox column to orders Table (list view) — header has indeterminate state when partial
- [ ] Create `src/components/explore/OrdersBulkBar.tsx`: sticky bar showing "N selected", DropdownMenu with actions, Cancel button. Render when selectedIds.size > 0
- [ ] Create `src/components/explore/BulkActionConfirm.tsx`: Dialog with job description, count, estimated time, confirm/cancel buttons, loading state during createJob
- [ ] Wire bulk bar actions: each opens BulkActionConfirm with job_type + payload preview
- [ ] On confirm: bulkJobService.createJob({store_id, job_type, payload: {order_ids, new_status?}, total}), show success toast "Job queued", clear selection, trigger progress toast (import from task-54)
- [ ] Reset selection when page/filter/search/tab changes (useEffect on deps)
- [ ] Disable bulk bar actions when selectedIds.size > 500 with tooltip "Max 500 per job"
- [ ] check_for_errors