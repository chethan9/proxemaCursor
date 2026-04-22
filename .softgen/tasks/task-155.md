---
title: Admin subscriptions + manual billing controls
status: todo
priority: high
type: feature
tags: [admin, billing, subscriptions]
created_by: agent
created_at: 2026-04-22T22:17:00Z
position: 155
---

## Notes
Admin panel for the ops team to oversee all subscriptions, intervene when needed, and process edge cases (refunds, comps, manual plan overrides).

**Philosophy:** every admin action here must produce an activity_log entry with the admin's identity and a required reason field. No silent overrides.

**Access:** super-admin only. Guard with `requireSuperAdmin`.

## Checklist
- [ ] `/admin/subscriptions` page: fleet-wide table with filters (status, plan, past_due only, trialing ending soon, lifetime value)
- [ ] Row click opens subscription detail drawer: client info, plan, status timeline (all subscription_events), recent invoices, payment method
- [ ] Manual actions in drawer (each requires reason input):
  - [ ] Unlock: flip locked → active (useful for "customer paid via bank transfer")
  - [ ] Comp plan: assign a plan for N months without charge (creates $0 invoices for the period)
  - [ ] Force plan change: switch plan outside normal upgrade flow
  - [ ] Issue refund: calls gateway.refund, creates negative invoice, adjusts LTV
  - [ ] Cancel immediately: skip grace period, set status=canceled, revoke access now
- [ ] `/admin/invoices` page: all invoices across all clients, filters (status, date range, client, amount range)
- [ ] Mark invoice as paid manually (for external payments): requires reason + reference number
- [ ] Bulk actions: export selected invoices as CSV, mark selected as uncollectible (with reason)
- [ ] Every action writes to activity_log with before/after + reason in metadata

## Acceptance
- Admin unlocks a subscription → customer immediately regains API access + activity_log shows who/when/why
- Admin comping a plan for 3 months generates 3 paid-zero invoices dated forward
- Admin refunding a charge through the UI creates a negative invoice and logs the gateway refund_id for reconciliation
- Attempting any action without a reason shows validation error