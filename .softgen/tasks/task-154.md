---
title: Billing page (user-facing)
status: done
priority: high
type: feature
tags: [billing, ui, user-experience]
created_by: agent
created_at: 2026-04-22T22:16:00Z
position: 154
---

## Notes
Single-page control center for customers: what they have, what they're using, what they've paid, what's next.

**Structure (top to bottom):**
1. Current plan card: plan name, price, next renewal date, **renewal mode indicator** ("Auto-renews" with a checkmark OR "Manual renewal — we'll email you"), "Change plan" + "Cancel" buttons, plus a conditional "Pay now" button when a manual invoice is due
2. Usage meters: Sites (4/5), Products (2,847/10,000), API calls this month (12,400/100,000) — progress bars, amber at 80%, red at 100%
3. Payment method card: default card (last4 + brand + expiry + recurring-eligible badge), "Update" + "Add another" — explains which cards unlock auto-renewal
4. Invoice history table: last 12 invoices, columns: number, date, amount, status (paid / due / failed), actions (view/print/pay-now)
5. Coupon redemption: single input field with "Apply" button; shows active coupon + remove option

No admin capabilities here — that's task-155. This is the self-service experience.

## Checklist
- [x] `/billing` page with current plan card + renewal mode indicator + usage meters + payment method shortcut
- [x] `CurrentPlanCard` renders effective status + renewal_mode
- [x] `UsageMeterCard` with progress bars for sites/products/users pulling from `lib/quota.getCurrentUsage`
- [x] `/api/billing/cancel` route to toggle `cancel_at_period_end`
- [ ] Invoice history table — deferred to task-153 (needs invoices table)
- [ ] Coupon redemption input — deferred to task-156
- [ ] Plan change dialog (upgrade/downgrade) — deferred to task-158 (pricing page owns the flow)
- [ ] Pay-now button for manual-mode due invoices — deferred to task-157 (cron creates the pending invoices)
- [ ] Renewal mode switch controls — deferred until task-152 tokenization lands

## Acceptance
- User on trialing plan sees "Trial ends in 7 days — add a card to continue" with inline "Add payment method" button
- User near quota (e.g. 4/5 sites) sees amber usage bar with inline "Upgrade" link
- Manual-mode user with a due invoice sees a prominent "Pay now — KWD 9" button; clicking it walks them through one-time checkout and returns to /billing with paid status
- Auto-mode user can see exactly when their next charge happens and which card it hits
- Canceling produces a clear dialog, undoable until the last day of the period
- Invoice print view is readable and ready for browser PDF export