---
title: Billing page (user-facing)
status: in_progress
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
- [ ] `/billing` page: plan card with live renewal countdown (e.g. "renews in 12 days on May 4") — wording adapts to mode: "auto-renews" vs "invoice due"
- [ ] Renewal mode row: shows current mode + plain-language explanation + link "How does this work?"; "Switch to manual" button when auto (with confirmation) and "Try enabling auto-renewal" button when manual (routes to add-card flow)
- [ ] Pay-now button is prominent when a manual invoice is pending; clicking it opens a one-time checkout (same flow as first charge, no token needed)
- [ ] Usage meter pulls from `lib/quota.getCurrentUsage()` — same source as quota enforcement, no drift
- [ ] Payment method section lists cards, each with "Auto-renewal eligible" badge (green check / grey x); default marker, inline delete/set-default, "Add card" triggers task-152 tokenize flow
- [ ] Invoice history table with search (by number) + year filter, pagination 10/page; failed/due invoices highlighted with inline "Pay now" action
- [ ] Click invoice row → opens drawer with line items + print button
- [ ] Coupon input validates via `/api/billing/coupons/validate?code=X` before apply; shows "Invalid" / "Expired" / "Already used" inline
- [ ] Cancel subscription flow: dialog explains "Access continues until May 4, then stops"; confirm sets cancel_at_period_end = true; can undo until period_end
- [ ] Change plan flow: lists other plans, upgrade = immediate + prorated charge prompt; downgrade = scheduled for next period
- [ ] All actions log to activity_log (including renewal mode changes)

## Acceptance
- User on trialing plan sees "Trial ends in 7 days — add a card to continue" with inline "Add payment method" button
- User near quota (e.g. 4/5 sites) sees amber usage bar with inline "Upgrade" link
- Manual-mode user with a due invoice sees a prominent "Pay now — KWD 9" button; clicking it walks them through one-time checkout and returns to /billing with paid status
- Auto-mode user can see exactly when their next charge happens and which card it hits
- Canceling produces a clear dialog, undoable until the last day of the period
- Invoice print view is readable and ready for browser PDF export