---
title: Payment gateway abstraction + MyFatoorah + Razorpay + country routing
status: todo
priority: urgent
type: feature
tags: [billing, payments, myfatoorah, razorpay, platform]
created_by: agent
created_at: 2026-04-22T22:12:00Z
position: 150
---

## Notes
Pluggable gateway layer with **two concrete adapters at launch** (MyFatoorah + Razorpay) plus a router that picks the right one based on the client's country.

### Why two gateways
- **MyFatoorah** — Middle East (Kuwait HQ). Critical because it supports KNET (Kuwait's national debit network), Mada (Saudi), Benefit (Bahrain), etc. Most ME customers cannot pay any other way.
- **Razorpay** — Rest of world, with strong support for India (INR, UPI, local cards) and international cards (USD, EUR, GBP, etc).

### Country-to-gateway mapping (hardcoded in `lib/payments/routing.ts`)
```
const MYFATOORAH_COUNTRIES = ['KW', 'SA', 'AE', 'BH', 'OM', 'QA', 'JO'];
function getGatewayForCountry(countryIso2: string): 'myfatoorah' | 'razorpay' {
  return MYFATOORAH_COUNTRIES.includes(countryIso2.toUpperCase()) ? 'myfatoorah' : 'razorpay';
}
```

### Country-to-currency mapping
```
KW → KWD, SA → SAR, AE → AED, BH → BHD, OM → OMR, QA → QAR, JO → JOD
IN → INR, default → USD
```
Currency is derived from country at signup but stored separately so admin can override (e.g., a Kuwait client who wants USD invoicing).

### Abstract interface (`lib/payments/gateway.ts`)
Every gateway implements:
- `initiateCharge(amount, currency, customerRef, metadata)` → `{ paymentUrl, gatewayInvoiceId, sdkPayload? }` (MyFatoorah returns hosted URL; Razorpay returns order_id + key_id for JS SDK)
- `tokenizeCard(customerRef, returnUrl)` → returns tokenization session (hosted flow for both)
- `chargeSavedToken(token, amount, currency, metadata)` → `{ success, gatewayInvoiceId, failureReason? }` (used by renewal cron)
- `refund(gatewayInvoiceId, amount)` → `{ refundId, status }`
- `parseWebhook(rawBody, headers)` → `{ eventType, gatewayInvoiceId, status, amount, metadata }` or throws on invalid signature
- `supportedCurrencies()` → string[] (MyFatoorah: KWD/SAR/AED/BHD/QAR/OMR/JOD/USD; Razorpay: INR/USD/EUR/GBP/SGD/AED + 100 others)

### MyFatoorah specifics (ref: https://docs.myfatoorah.com/docs/get-started)
- Base URL: test `https://apitest.myfatoorah.com` / live `https://api.myfatoorah.com`
- Auth: Bearer token from dashboard
- `POST /v2/InitiatePayment` → list payment methods available for amount/currency
- `POST /v2/ExecutePayment` → creates invoice, returns `PaymentURL` (hosted checkout)
- Tokenization: returns `RecurringId` on first successful paid charge if `SaveToken=true`
- Recurring charge: `POST /v2/DirectPayment` with `Token`
- Webhook signature: HMAC-SHA256, secret from dashboard, header `MyFatoorah-Signature`

### Razorpay specifics (ref: https://razorpay.com/docs/)
- Base URL: `https://api.razorpay.com/v1`
- Auth: HTTP Basic with `key_id:key_secret`
- `POST /orders` → `{ amount: paise, currency, notes }` returns `order_id`
- Frontend: Razorpay Checkout JS SDK (`checkout.razorpay.com/v1/checkout.js`) opens hosted modal with `{ key, order_id, prefill, handler }`
- Tokenization: saved cards via "tokens" — requires enabling "Recurring Payments" on account; token flow uses `POST /customers/{id}/tokens`
- Recurring charge: `POST /payments/create/recurring` with saved `token_id`
- Webhook signature: HMAC-SHA256 of raw body with webhook secret, header `X-Razorpay-Signature`

### Env vars
- `MYFATOORAH_API_KEY`, `MYFATOORAH_BASE_URL`, `MYFATOORAH_WEBHOOK_SECRET`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` (needed in browser for checkout SDK)

All documented in `README.md` and `.env.local.example`.

## Checklist
- [ ] Abstract `PaymentGateway` interface in `lib/payments/gateway.ts` with methods + `supportedCurrencies()`
- [ ] `lib/payments/myfatoorah.ts` concrete adapter: all endpoints above, retry on 5xx, 30s timeout, signature verification
- [ ] `lib/payments/razorpay.ts` concrete adapter: Orders API, Tokens API for recurring, webhook HMAC verification
- [ ] `lib/payments/routing.ts` with `getGatewayForCountry(iso2)` + `getCurrencyForCountry(iso2)` + exported country/currency lists
- [ ] `lib/payments/index.ts` factory: `getGateway(name)` returns adapter; `getGatewayForClient(clientId)` reads `clients.country` and returns correct adapter
- [ ] `payment_methods` table: id, client_id, gateway (string), gateway_token, card_brand, last4, expiry_month, expiry_year, currency, is_default, created_at
- [ ] `clients` table gets: `country` (char(2), default 'US'), `currency` (char(3), default 'USD')
- [ ] Webhook receiver `/api/payments/webhooks/[gateway].ts` (single route, dispatches by `[gateway]` param) — validates signature per adapter, hands off to subscription state machine (task-157)
- [ ] Server-only — gateway secrets never leak to browser. Only `NEXT_PUBLIC_RAZORPAY_KEY_ID` is client-exposed (required by Razorpay JS SDK).
- [ ] Adapters accept injected HTTP client so they're unit-testable with mocked fetch
- [ ] README section for each gateway: dashboard signup, test keys, webhook URL registration

## Acceptance
- `getGatewayForClient(clientIdInSaudi)` returns a MyFatoorah adapter; `getGatewayForClient(clientIdInUS)` returns Razorpay
- Calling `gateway.initiateCharge(29, 'USD', 'cust_1', { planId: 'growth' })` on Razorpay test keys returns a real order_id usable by the JS SDK
- Calling `initiateCharge(9, 'KWD', ...)` on MyFatoorah test keys returns a real PaymentURL
- Sending a forged webhook payload to either `/api/payments/webhooks/myfatoorah` or `/api/payments/webhooks/razorpay` returns 401; properly-signed webhook returns 200 and logs the event
- Test refund on either gateway succeeds and returns the refundId
- `supportedCurrencies()` returns accurate lists that the admin UI can validate against when setting plan prices