---
title: Subscriptions (schema, state machine, enforcement middleware)
status: done
priority: urgent
type: feature
tags: [billing, subscriptions, middleware, platform]
created_by: agent
created_at: 2026-04-22T22:13:00Z
position: 151
---

## Notes
Subscriptions are where the money and access meet. Every API request from a client eventually gates on a single question: "is this client's subscription active?"

**Renewal modes — debit-card reality:**

Not all cards support stored-credential recurring charges. Indian debit cards under RBI rules often reject `auto_subsequent_payment`; some Middle East debit cards have the same limitation. We support both modes as first-class:

- `renewal_mode = 'auto'` — we charge the saved token on period_end (happy path)
- `renewal_mode = 'manual'` — we create an invoice 3 days before period_end and send a pay-now link; customer pays each cycle as a one-time charge

Both modes share the same access rules, state machine, and grace period — only the charge mechanism differs.

## Checklist
- [x] `subscriptions` table with all required columns including renewal_mode, auto_renew_disabled_reason, grace_period_days, currency snapshot
- [x] Unique constraint: partial unique index on client_id WHERE status != 'canceled'
- [x] `subscription_events` table with event_type, from_status, to_status, actor_user_id, metadata
- [x] `lib/subscription-state.ts` with canTransition, hasAccess, daysUntilLock, effectiveStatus helpers
- [x] `lib/subscription-guard.ts` with requireActiveSubscription middleware (returns 402 + actionable body)
- [x] RLS: clients read own, super admins read/write all; events readable to client owners
- [x] Audit trigger attached — every subscription change flows into activity_log
- [x] `useSubscription()` hook exposing status, hasAccess, daysUntilLock
- [x] `createTrialSubscription` + `insertSubscriptionEvent` service helpers
- [ ] Apply middleware to `/api/stores/[storeId]/*` and `/api/v1/*` routes — deferred to task-155/157 when we have real subscribers to gate
- [ ] UI banner for past_due/locked — deferred to task-154 (billing page has the full UI)

## Acceptance
- `hasAccess({status:'active',...})` returns true; `hasAccess({status:'locked',...})` returns false
- `hasAccess({status:'past_due', current_period_end: yesterday, grace_period_days: 7})` returns true (still in grace)
- `hasAccess({status:'past_due', current_period_end: 8 days ago, grace_period_days: 7})` returns false
- Canceled subscriptions cannot be re-activated (canTransition('canceled', 'active') = false)
- Attempting INSERT/UPDATE on subscriptions as non-admin is rejected by RLS
- All state transitions appear in activity_log via the generic trigger