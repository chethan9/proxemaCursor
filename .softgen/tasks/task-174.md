---
title: Admin subscriptions management
status: done
priority: urgent
type: feature
tags: [billing, admin, subscriptions]
created_by: agent
created_at: 2026-04-23T20:00:00Z
position: 174
---

## Notes

Super admin needs a UI to manage per-client subscriptions — assign plans, override status, extend trials, issue comps, cancel. Currently subscriptions can only be manipulated via raw SQL, which blocks testing and ops.

Project brief calls this out explicitly: "Admin panel: plans CRUD (per-currency prices), subscriptions overview, manual refunds/comps/plan overrides, coupons CRUD".

Build as a new route under settings, super_admin only (use `SettingsLayout requireSuperAdmin`). Extend `src/services/subscriptionService.ts` with admin mutations (list all, upsert, override status). Log every mutation via `src/services/activityLogService.ts` (entity_type `subscription`) since brief mandates billing actions be auditable.

Status values follow `src/lib/subscription-state.ts`: trialing, active, past_due, locked, canceled.

## Checklist

- [x] Subscriptions list page at `/settings/subscriptions` (super_admin only): table with client name, current plan, status badge (color-coded per state), current period end, grace period days, last event timestamp. Search by client, filter by status.
- [x] Row click opens subscription detail drawer/dialog: current plan selector (all active plans from `plans` table), status selector (trialing/active/past_due/locked/canceled), period start + end date pickers, grace period days field, notes textarea
- [x] "Assign subscription" action for clients without one: client picker (shows only clients missing a subscription) + plan picker + status + period dates
- [x] Quick actions in drawer: Extend trial 14/30 days, Cancel immediately, Reactivate, Switch plan (prompts for new plan + effective date)
- [x] Every mutation writes a row to `activity_log` (entity_type=subscription, action=assigned/switched/canceled/extended, before/after diff) and a row to `subscription_events`
- [x] Embed `ActivityHistoryDrawer` inside the subscription detail view so super_admin sees the full override history per subscription
- [x] Sidebar link in `SettingsLayout.tsx` Admin group, super_admin only, label "Subscriptions"

## Acceptance

- Super admin navigates to Settings → Subscriptions, sees every client's subscription state in one table
- Assigning a plan to a client without a subscription lifts the `/pricing` redirect for that client immediately
- Switching a client from plan A to plan B, canceling, and reactivating all show up in the activity history for that subscription

## Follow-ups (post-MVP, optional)

- [ ] `/admin/invoices` page: fleet-wide invoice table with filters, CSV export, mark-as-paid for external/bank-transfer payments
- [ ] Manual refund action in subscription drawer: calls `gateway.refund`, creates negative invoice, logs gateway refund_id
- [ ] Comp-plan action: assign a plan for N months without charge (creates $0 invoices dated forward)
- [ ] Bulk action: mark selected invoices as uncollectible with reason
- [ ] Require reason input on every destructive admin action (validation error if missing) and persist reason in `activity_log.metadata`