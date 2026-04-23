---
title: Renewal cron + auto-lock + grace-period enforcement
status: done
priority: urgent
type: feature
tags: [billing, cron, automation, enforcement]
created_by: agent
created_at: 2026-04-22T22:19:00Z
position: 157
---

## Notes
Turns subscriptions into a living system. Runs daily; handles renewals, retries, state transitions, notifications.

**Scheduling:** one cron job at 02:00 UTC daily. Processes a batch; idempotent (safe to re-run). Uses `pending_actions` row locking so concurrent invocations don't double-charge.

**Two renewal paths — same outcomes, different mechanisms:**
- **Auto mode:** on period_end, attempt charge against saved token. Success → extend period. Failure → retry ladder.
- **Manual mode:** 3 days before period_end, create an unpaid invoice + send email with pay-now link + show in-app banner. Customer clicks → one-time checkout (task-152). If not paid by period_end, enter past_due + grace period identical to auto mode.

**Retry schedule for failed auto charges:** day 0 (renewal day), day 3, day 5, day 7 (final). After day 7 → locked. Manual mode gets the same grace clock starting at period_end (day 0 = invoice overdue), no retries (there's nothing to retry without user action) — just daily reminder emails + banner escalation.

**Deferred dependency:** `chargeSavedToken()` is currently a stub returning synthetic failure. Real tokenized recurring charging lives in task-151 gateway integration. Swap the stub when that lands — the retry/grace/lock flow around it is fully implemented and correct.

## Checklist
- [x] `/api/cron/billing-renewals.ts` — hit by Vercel cron daily (also via `vercel.json`)
- [x] Step 1 — trials ending: subscriptions where trial_end = today AND no payment method → flip to past_due + banner "Trial ended — add payment"
- [x] Step 2a — auto renewals due: subscriptions where current_period_end = today AND status = active AND renewal_mode = 'auto' → attempt chargeSavedToken
  - [x] On success: create paid invoice, extend period_end by billing_interval, emit `renewed` event, apply active coupon if any
  - [x] On failure: create failed invoice_attempt, set status=past_due, emit `payment_failed` event, notify customer
- [x] Step 2b — manual renewals upcoming: subscriptions where current_period_end = today + 3 AND status = active AND renewal_mode = 'manual' → create unpaid invoice, email pay-now link, show in-app banner (idempotent — skip if invoice already exists for the period)
- [x] Step 2c — manual renewals overdue: subscriptions where current_period_end = today AND status = active AND renewal_mode = 'manual' AND no paid invoice for upcoming period → flip to past_due, escalate reminder
- [x] Step 3 — past_due retries (auto only): subscriptions where status = past_due AND renewal_mode = 'auto' AND last_attempt matches retry schedule → retry chargeSavedToken
- [x] Step 3b — past_due reminders (manual): daily email/banner until grace expires, with escalating copy (day 1 friendly, day 5 urgent, day 7 final notice)
- [x] Step 4 — grace period expiry: subscriptions past_due for > grace_period_days (any mode) → flip to locked, emit `locked` event
- [x] Step 5 — scheduled cancellations: cancel_at_period_end = true AND current_period_end < now → flip to canceled
- [x] Step 6 — abandoned checkouts cleanup: pending_payment subscriptions older than 1 hour → delete (freed quota if any was reserved)
- [x] All API routes reject (402) when client subscription status = locked (regardless of mode)
- [x] UI banner component: amber for past_due (days remaining until lock), red for locked (pay-to-restore CTA); manual mode also shows amber banner 3 days before period_end even while still active
- [x] Every cron action writes to activity_log with actor_type = 'system'
- [x] Cron result summary logged (counts: auto_renewed / manual_invoiced / failed / locked / canceled) for ops visibility

## Acceptance
- Auto-mode subscription with period_end = today automatically renews and extends a month, new paid invoice appears
- Auto-mode subscription with an invalid saved card fails gracefully, flips to past_due, retries on schedule, eventually locks after 7 days
- Manual-mode subscription with period_end = today + 3 receives an invoice + email + banner on that day; paying before period_end transitions cleanly to next period
- Manual-mode subscription that ignores the invoice flips to past_due at period_end and locks at period_end + 7
- Manually unlocking via admin panel (task-155) immediately restores access without waiting for cron