---
title: Sync completion notifications - celebrate partial success + alert on failures
status: done
priority: high
type: feature
tags: [sync, notifications]
created_by: agent
created_at: 2026-04-20
position: 100
---

## Notes
Current behavior in `src/pages/api/stores/[storeId]/sync.ts` fires the celebration notification when the `all` row completes, but when any child aspect fails (e.g. variations), the whole run is marked `failed` in the catch block or the `all` row never transitions to completed, so no celebration appears and no failure alert is raised either.

Two problems to fix:
1. Celebration should fire on completion even when some non-critical aspects failed (e.g. variations failed but products/orders/customers succeeded). Stamp `initial_sync_completed_at` and send celebration as long as products + orders + customers succeeded.
2. When ANY aspect fails, insert a failure notification for the same set of users with type `sync_failure`, linking to the sync engine tab: `/projects/{client_id}?tab=sync&store={storeId}` (or `/projects/{store.client_id}` with query). On click the user lands on the sync engine tab and can click "Sync" for the failed aspect to retry.

Files:
- `src/pages/api/stores/[storeId]/sync.ts` — main sync orchestrator, has the celebration logic at the bottom. Add failure-path notification insertion after results are collected.
- `src/components/notifications/NotificationRenderer.tsx` — may already handle generic CTA clicks; confirm sync_failure type renders with a red accent.
- `src/pages/projects/[id].tsx` — should already read `?tab=` and `?store=` query params to preselect the sync engine; verify and wire if missing.

## Checklist
- [x] After all aspects run, compute failed aspects from `results` (entries with `error` key)
- [x] If any failed: insert one `user_notifications` row per user (same audience as celebration) with `type=sync_failure`, title like "Sync issue on {store}", body listing failed aspects, CTA "Open sync engine" linking to `/projects/{client_id}?tab=sync&store={storeId}`, priority 80, red/destructive accent metadata
- [x] Celebration still fires as long as core aspects (products, orders, customers) succeeded, even if variations/coupons/tags failed — keep "Welcome aboard" copy
- [x] If core aspects failed: skip celebration, only send failure notification
- [x] Sync engine tab on projects page honors `?tab=sync&store={id}` query to auto-select that store's sync engine view
- [x] Notification renderer shows sync_failure with a warning/destructive icon (AlertTriangle) and destructive-tinted background

## Acceptance
- Trigger a sync where variations fail (simulate by breaking variation fetch) — products/orders still succeed, celebration popup fires AND a separate failure notification appears in the bell
- Click the failure notification — lands on Projects → Sync Engine tab for that store
- If all aspects succeed, only celebration appears (no false failure alert)
- If products fetch itself fails, no celebration, only failure alert