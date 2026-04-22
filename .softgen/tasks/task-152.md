---
title: Checkout flow + payment method tokenization (multi-gateway)
status: done
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

### V1 shipped — tokenization stubbed
Real stored-credential tokenization (MyFatoorah TokenData / Razorpay Tokens API) requires live gateway credentials to test the eligibility signals on real debit cards. Until those land, `/api/billing/verify` sets `renewal_mode = 'manual'` with `auto_renew_disabled_reason = 'tokenization_not_implemented'`. The full framework for auto vs manual mode is already in place (schema, UI copy, middleware) — flipping tokenization on later is a one-function change in each adapter.

## Checklist
- [x] `client_payment_methods` table (gateway, gateway_token, card_brand, last4, expiry, is_default, recurring_eligible) + RLS + audit trigger
- [x] `/api/billing/checkout` — auth check, resolves client's gateway via country, upserts pending subscription, picks `prices[currency]` from plan, calls `initiateCharge`, returns `{ gateway, payload, subscriptionId }`
- [x] `/api/billing/verify` — gateway-agnostic: polls status, on paid activates subscription + extends period, writes subscription_event, returns `{ status, subscription, renewalMode }`
- [x] `lib/razorpay-client.ts` — lazy-loads Razorpay checkout.js SDK, exposes `openRazorpayCheckout(opts)` wrapper
- [x] `useCheckout()` hook — unified entry point: calls /api/billing/checkout, branches on gateway (redirect vs inline modal), polls /api/billing/verify on success, exposes loading/error state
- [x] `/billing/return` — MyFatoorah callback landing page: polls verify every 2s up to 10 tries, shows success/pending/failed states with appropriate CTAs
- [x] `/billing/payment-methods` — list saved cards grouped by gateway, default marker, set-default + remove actions, empty state with "add card" note
- [ ] Real tokenization in both adapters (Razorpay Tokens API, MyFatoorah recurring flag) — deferred until live gateway keys available
- [ ] Tokenize-only flow for "add card without charging" — deferred with tokenization
- [ ] Auto-mode / manual-mode UI differentiation on success screen — deferred with tokenization (always manual for now)
- [ ] Cron cleanup of abandoned pending_payment subs older than 1 hour — covered by task-157

## Acceptance
- User with country=IN clicking Subscribe → Razorpay modal opens in-page, pays with test card, modal closes, `/api/billing/verify` flips subscription to active with INR period
- User with country=SA clicking Subscribe → redirects to MyFatoorah hosted page, pays, redirects back to `/billing/return`, which polls and shows success with SAR period
- Closing either gateway's checkout without paying leaves subscription in pending_payment (cleanup cron in task-157)
- `/billing/payment-methods` empty state for new customer shows "no saved cards" with note that they'll be able to save cards once live gateway tokenization is enabled
- All subscription state transitions trigger `subscription_events` rows + activity_log entries via the existing trigger