---
title: Subscriptions (schema, state machine, enforcement middleware)
status: todo
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

**Mode is determined at checkout, not a customer choice** (by default):
1. First charge always succeeds as a one-time payment (no token assumption)
2. Immediately after, adapter attempts tokenization + a test recurring-eligibility call (₹1 auth + void for Razorpay, 0.100 KWD hold + refund for MyFatoorah)
3. If that succeeds → `renewal_mode = 'auto'`, token saved
4. If that fails with a "not eligible for recurring" signal → `renewal_mode = 'manual'`, `auto_renew_disabled_reason` populated
5. Customer is always notified of the mode; if they want to switch, they can add a different card later

## Checklist
- [ ] `subscriptions` table: id, client_id, plan_id, status (enum: trialing/active/past_due/locked/canceled/pending_payment), current_period_start, current_period_end, trial_end, cancel_at_period_end (bool), canceled_at, gateway, gateway_subscription_ref, payment_method_id, currency (char(3), snapshot of client currency at subscription creation — preserved for invoice consistency), renewal_mode (enum 'auto' | 'manual', default 'auto'), auto_renew_disabled_reason (text, null unless manual), last_charge_attempt_at, last_charge_failed_at, grace_period_days (default 7), created_at, updated_at
- [ ] Unique constraint: one active subscription per client (partial unique index on client_id WHERE status IN ('trialing','active','past_due'))
- [ ] `subscription_events` table: id, subscription_id, event_type (created / trial_started / activated / renewed / payment_failed / past_due / locked / unlocked / canceled / plan_changed), metadata (jsonb), created_at — feeds audit log via trigger from task-148
- [ ] `lib/subscriptions/state-machine.ts` with transition functions, each validates the current state and writes a subscription_event
- [ ] `lib/subscriptions/require-active.ts` middleware helper; covers Pages Router API handler signature
- [ ] Apply middleware to: all `/api/stores/[storeId]/*` routes, `/api/v1/*` routes, sync/webhook-register actions (read-only `/api/v1/*` GET can still work on past_due to ease recovery — block only on locked)
- [ ] UI: `useSubscription()` hook exposing status, period_end, days_until_renewal; AppLayout shows red banner for locked and amber banner for past_due
- [ ] Helper: `getOrCreateTrialSubscription(clientId)` auto-provisions 14-day trial on first client creation
- [ ] State machine helpers in `lib/subscription-state.ts`: transition(sub, event) with validated moves (pending_payment → active, active → past_due, past_due → active|locked, locked → active|canceled, etc.)
- [ ] Helper `setRenewalMode(subscriptionId, mode, reason?)` — writes to subscription + emits subscription_event + activity_log entry
- [ ] Middleware `requireActiveSubscription(clientId)` — returns 402 with body `{ error, subscriptionStatus, lockedReason }` if status in (past_due+out_of_grace, locked, canceled)

## Acceptance
- Customer with normal credit card: subscription created as `renewal_mode='auto'`, card token saved, renewal cron charges cleanly
- Customer with non-recurring-eligible debit card: first charge succeeds, tokenization rejects → subscription flagged `renewal_mode='manual'` with `auto_renew_disabled_reason='card_not_recurring_eligible'`, clear UI notice shown
- Customer in manual mode maintains full access between period_end → grace expiry exactly like auto mode
- Locked subscription blocks public API `/api/v1/*` with 402 + actionable body, regardless of mode
- Admin page shows count of manual-mode subs as a health metric (if high, could signal gateway config issue)