---
title: Upgrade webhooks pages with cache, pagination, filters, CSV export
status: todo
priority: high
type: feature
tags: [logs, performance]
created_by: agent
created_at: 2026-04-18
position: 45
---

## Notes
Two pages:
- `src/pages/webhooks/index.tsx` (354 lines) — registered webhooks across sites
- `src/pages/webhooks/activity.tsx` (564 lines) — incoming webhook event log

Activity page filters:
- Site
- Event type (product.created, order.updated, etc.)
- Result (delivered, failed, retried, ignored)
- Date range
- Search (payload, error message)

Webhooks index filters:
- Site
- Status (active/paused/failed)
- Topic
- Search

CSV export for activity: event id, site, topic, result, received_at, processed_at, duration_ms, error.
CSV export for index: site, topic, delivery_url, status, last_delivery, failure_count.

Apply full conventions: React Query hooks, useBackgroundPagination, debounced search, isLoading shimmer.

## Checklist
- [ ] Extend useWebhooks hook with filter params
- [ ] Create src/hooks/queries/useWebhookActivity.ts (if not exists)
- [ ] Create src/components/webhooks/WebhooksFilterBar.tsx
- [ ] Create src/components/webhooks/WebhookActivityFilters.tsx
- [ ] Create src/components/webhooks/WebhookActivityTable.tsx
- [ ] Rewrite src/pages/webhooks/index.tsx using hooks pattern + filters + export
- [ ] Rewrite src/pages/webhooks/activity.tsx using hooks pattern + filters + export
- [ ] Wire useBackgroundPagination on both
- [ ] check_for_errors