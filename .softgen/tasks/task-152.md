---
title: Checkout flow + payment method tokenization (multi-gateway)
status: todo
priority: high
type: feature
tags: [billing, checkout, myfatoorah, razorpay, payment-methods]
created_by: agent
created_at: 2026-04-22T22:14:00Z
position: 152
---

## Notes
How customers actually pay. Uses hosted payment flows for PCI scope reduction — we never touch card numbers.

**Two checkout UX patterns** — the gateway abstraction hides most of the difference but the frontend has to handle both:
- **MyFatoorah**: server returns a `paymentUrl`, browser redirects to hosted page, gateway redirects back to `/billing/return`
- **Razorpay**: server returns `{ order_id, key_id, amount, currency, prefill }`, frontend opens Razorpay Checkout JS modal, user pays in-page, modal closes with `payment_id` → frontend posts to `/api/billing/verify`

Both flows converge at `/api/billing/verify` which activates the subscription.

**Flow (unified):**
1. User picks a plan on pricing page → POST `/api/billing/checkout` with `{ planId, couponCode? }`
2. Server resolves client's gateway via country routing (task-150), creates/updates subscription in `pending_payment`, calls `gateway.initiateCharge(priceInClientCurrency, currency, ...)`, returns `{ gateway: 'myfatoorah' | 'razorpay', payload }`
3. Frontend branches:
   - MyFatoorah → `window.location = payload.paymentUrl`
   - Razorpay → load `checkout.razorpay.com/v1/checkout.js`, instantiate with `payload`, handle success callback
4. Verify: `/api/billing/verify` called either by return page (MyFatoorah) or Razorpay success handler → server queries gateway → on success activates subscription, **attempts tokenization for recurring**, logs activity
5. **Tokenization outcome:**
   - Success → `renewal_mode='auto'`, payment_method saved with token, customer sees "Auto-renewal enabled"
   - Failure (card not recurring-eligible) → `renewal_mode='manual'`, `auto_renew_disabled_reason='card_not_recurring_eligible'`, customer sees friendly banner: "Your bank doesn't allow auto-renewal on this card. We'll email you a payment link each period. You can add a different card anytime to enable auto-renewal."
6. Either way: subscription is active, access granted immediately. Manual mode is not a failure state.
7. Redirect to `/billing` with success toast reflecting the mode

**Idempotency:** both flows write through `gateway_invoice_id` as natural key so webhook + verify path don't double-process.

## Checklist
- [ ] Pricing page shows "Start trial" (no card) and "Subscribe" (starts checkout) — button label and currency pulled from client's resolved currency
- [ ] `/api/billing/checkout` route: validates plan + coupon, resolves gateway via `getGatewayForClient`, picks `prices[currency]` from the plan, creates pending subscription, calls `initiateCharge`, returns `{ gateway, payload }`
- [ ] `/billing/return` page (MyFatoorah only): shows spinner while verifying, then success/failure state
- [ ] Razorpay success handler: in-page, receives `{ payment_id, order_id, signature }`, posts to `/api/billing/verify` — no page navigation needed
- [ ] Post-charge tokenization: adapter method `attemptRecurringSetup(paymentRef)` — Razorpay tries saving token via their Tokens API, MyFatoorah via recurring-auth flag; returns `{ mode: 'auto'|'manual', token?, reason? }`
- [ ] `/api/billing/verify` route: gateway-agnostic — takes `{ gateway, invoiceRef }`, calls the right adapter's status endpoint, calls `attemptRecurringSetup`, activates subscription with resolved `renewal_mode`, writes `payment_methods` row (if token), returns `{ status, subscription, renewalMode }`
- [ ] UI: success page distinguishes the two modes with distinct copy + icon; manual mode shows "How it works" explainer + "Try a different card for auto-renewal" link
- [ ] Save returned card token + metadata (brand, last4, expiry, gateway, recurring_eligible boolean) to `payment_methods`, mark as default
- [ ] `/billing/payment-methods` page: badge each card with "Auto-renewal: ✓ / ✗"; adding a recurring-eligible card automatically offers to switch the subscription to auto mode; removing the only eligible card auto-flips to manual
- [ ] Handle checkout abandonment: pending_payment subscriptions older than 1 hour cleared by cron (task-157)
- [ ] All state changes (including renewal_mode flips) emit subscription_events (fed into activity_log)

## Acceptance
- User in India pays with a recurring-eligible HDFC credit card → subscription active + auto mode + token saved
- User in India pays with a non-recurring Kotak debit card → subscription active + manual mode + clear "we'll email you" notice; no broken UX
- User in Kuwait pays with KNET debit → manual mode (KNET doesn't support stored credential) with same clear notice
- Closing either gateway's checkout without paying leaves subscription in pending_payment; auto-cleared after 1 hour
- Adding a recurring-eligible card while in manual mode surfaces an "Enable auto-renewal" banner; one click switches the subscription