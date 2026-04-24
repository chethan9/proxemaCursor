---
title: Tap payment gateway integration
status: todo
priority: high
type: feature
tags: [payments, tap, gateway]
created_by: agent
created_at: 2026-04-24T23:05:00Z
position: 193
---

## Notes

Add Tap as a third payment gateway alongside MyFatoorah and Razorpay. Integration uses **Tap Card SDK Web v1** for in-browser tokenization + server-side **Create a Charge** API call with the token — matches the inline pattern we already use for Razorpay. Auth is Bearer secret key. Webhook posts async status updates.

Tap covers the same MENA region as MyFatoorah (KW/SA/AE/BH/OM/QA/JO + EG). Both coexist — the admin settings page (task-194) picks which one is active per country. Default fallback keeps MyFatoorah as MENA primary; Tap is opt-in until an admin flips it.

**Adapter location:** `src/lib/payments/tap.ts` — implements `PaymentGateway` from `src/lib/payments/types.ts`. Register in `src/lib/payments/index.ts` and extend `GatewayName = "myfatoorah" | "razorpay" | "tap"`.

**Frontend tokenization:** new component loading `https://secure.gosell.io/js/sdk/tap.min.js` and `bluebird.min.js` (Tap requires both), instantiating `Tapjsli(publishableKey)`, mounting card element, calling `tap.createToken()` on submit, posting token to our server.

**Server endpoints (new):**
- `src/pages/api/billing/tap/init.ts` — returns publishable key + prefill data for the inline form
- `src/pages/api/billing/tap/charge.ts` — receives `{ tokenId, clientReference, amountMinor, currency }`, calls Tap `POST https://api.tap.company/v2/charges/` with Authorization: Bearer sk_xxx, returns `{ status, transactionUrl?, gatewayRef }`. If response has `transaction.url` (3DS redirect), return it for the client to redirect; otherwise status resolves immediately.
- `src/pages/api/billing/webhooks/tap.ts` — receives charge status webhook, verifies signature (hashstring HMAC), updates our `payments` + `subscriptions` tables via shared `handleWebhookEvent` helper used by the other gateways.

**Env vars:** `TAP_SECRET_KEY`, `TAP_PUBLIC_KEY`, `TAP_WEBHOOK_SECRET`. Keep as fallback — task-194 introduces DB-backed overrides that take precedence when present.

**Currencies:** Tap supports KWD, SAR, AED, BHD, OMR, QAR, JOD, EGP, USD. `supportedCurrencies()` should return this list.

**Charges API payload essentials:**
- `amount`, `currency`
- `threeDSecure: true`
- `customer`: `{ first_name, email, phone: { country_code, number } }`
- `source`: `{ id: tokenId }` (the token from Card SDK)
- `redirect: { url: returnUrl }` — for 3DS challenge return
- `post: { url: webhookUrl }` — per-charge webhook callback (optional, global webhook is enough)
- `reference: { transaction: clientReference }`

**Status mapping:** Tap `status` → our `PaymentStatus`:
- `CAPTURED` / `AUTHORIZED` → `paid`
- `INITIATED` / `IN_PROGRESS` → `pending`
- `FAILED` / `DECLINED` / `ABANDONED` → `failed`
- `CANCELLED` → `canceled`
- `VOIDED` → `canceled`

**Routing change:** `getGatewayForCountry` keeps returning `"myfatoorah"` for MENA by default; task-194 adds a DB-backed override layer on top. This task should expose the override hook (accept an optional `countryOverrides: Record<string, GatewayName>` map) but keep default behavior unchanged.

## Checklist

- [ ] `src/lib/payments/types.ts`: add `"tap"` to `GatewayName` union; add `TapInitPayload = { type: "inline"; publishableKey: string; prefill: {...} }` to the `ChargeInitiated.payload` union
- [ ] `src/lib/payments/tap.ts`: implement `PaymentGateway` adapter — `initiateCharge` returns the inline payload, `getPaymentStatus` hits `GET /v2/charges/{id}`, `refund` hits `POST /v2/refunds`, `parseWebhook` validates signature + maps to `WebhookEvent`
- [ ] Register Tap in `src/lib/payments/index.ts` `getGateway()` + `getAllGateways()`
- [ ] Extend `getGatewayForCountry` in `routing.ts` to accept an override map parameter (still defaults to current behavior)
- [ ] Frontend `TapCardForm` component: loads Tap scripts lazily, mounts card element with styling matching our theme, validates on change, calls `tap.createToken()` on submit, POSTs `{ tokenId }` to our charge endpoint
- [ ] Wire `TapCardForm` into the existing checkout flow (`useCheckout` hook) — when `getGatewayForClient(country)` returns `"tap"`, render this form instead of Razorpay's inline or MyFatoorah's redirect
- [ ] Server endpoint `/api/billing/tap/charge.ts`: calls Tap Charges API with Bearer auth, persists a row in `payments` table with `gateway: "tap"` and `status: "pending"`, returns `{ transactionUrl }` if 3DS required
- [ ] Server endpoint `/api/billing/webhooks/tap.ts`: verifies signature using `TAP_WEBHOOK_SECRET` HMAC, maps status, updates `payments` + `subscriptions` rows, logs to `activity_log`
- [ ] Billing return page `/billing/return` handles Tap's `?tap_id=chg_xxx` query param (in addition to the existing gateway returns) — calls our `/api/billing/verify?gateway=tap&ref=chg_xxx` to finalize
- [ ] Add Tap test cards to a dev reference doc (`docs/PAYMENTS.md` or similar) so the team can test sandbox flow
- [ ] Admin gateway health endpoint (`/api/billing/gateway/health`) also pings Tap (balance endpoint or a no-op charge retrieve) and returns `{ tap: "ok" | "error" }`

## Acceptance

- A user in Kuwait with Tap set as active gateway (via task-194 UI, or env default) completes a subscription payment via the inline card form without leaving the page (or via 3DS redirect when bank requires it), and their subscription row flips to `active` after webhook arrives.
- Sending a manually crafted webhook to `/api/billing/webhooks/tap` with a valid signature updates the matching payment row; invalid signature returns 401.
- Gateway health endpoint includes Tap status and degrades gracefully (returns `error` not 500) when Tap creds are missing.