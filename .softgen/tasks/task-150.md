---
title: Payment gateway abstraction + MyFatoorah + Razorpay + country routing
status: done
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

### Env vars (documented in `.env.local`)
- `MYFATOORAH_API_KEY`, `MYFATOORAH_BASE_URL`, `MYFATOORAH_WEBHOOK_SECRET`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` (consumed by task-152 checkout modal, not by server)

## Checklist
- [x] Abstract `PaymentGateway` interface in `lib/payments/types.ts` with methods + `supportedCurrencies()` + `isConfigured()`
- [x] `lib/payments/myfatoorah.ts` concrete adapter: ExecutePayment, GetPaymentStatus, MakeRefund, webhook auth-key check, 2/3-decimal currency handling
- [x] `lib/payments/razorpay.ts` concrete adapter: Orders API, refund via order→payment lookup, HMAC-SHA256 webhook signature verification
- [x] `lib/payments/routing.ts` with `getGatewayForCountry(iso2)` + `getDefaultCurrencyForCountry(iso2)` + `getSupportedCountries()` (32 countries across 6 regions)
- [x] `lib/payments/index.ts` factory: `getGateway(name)` + `getGatewayForClient(country)` + `getAllGateways()`
- [x] `clients` table gets `country` (char(2)) + `currency` (char(3), default USD)
- [x] Webhook receivers `/api/billing/webhooks/myfatoorah.ts` + `/api/billing/webhooks/razorpay.ts` with raw-body parsing + signature validation + activity_log insert
- [x] Health/diagnostic endpoint `/api/billing/gateway/health?country=KW` returns gateway config status + resolved gateway+currency for a country
- [x] Server-only — gateway secrets never leak to browser
- [x] Adapters read env on every call (not constructor) — safe for Next.js hot reload + env changes
- [ ] `payment_methods` tokenized-card table — deferred to task-152 (needed only when we actually save a token at checkout)
- [ ] README section for each gateway dashboard + webhook registration — deferred to docs pass after task-157

## Acceptance
- `getGatewayForCountry("SA")` returns `myfatoorah`; `getGatewayForCountry("US")` returns `razorpay`
- `getDefaultCurrencyForCountry("IN")` returns `INR`; `getDefaultCurrencyForCountry("KW")` returns `KWD`
- `GET /api/billing/gateway/health?country=AE` returns `{ gateway: 'myfatoorah', currency: 'AED' }` plus per-gateway configured/supportedCurrencies list
- Sending a forged webhook to either endpoint returns 401; properly-signed returns 200 and writes to activity_log
- Adapters fail fast with clear error if env keys missing (no silent empty requests)
