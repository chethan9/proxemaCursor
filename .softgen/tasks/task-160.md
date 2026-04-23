---
title: Country + currency detection, storage, and profile override
status: done
priority: medium
type: feature
tags: [billing, currency, profile]
created_by: agent
created_at: 2026-04-22T22:40:00Z
position: 160
---

## Notes
The plumbing layer that task-158 depends on. Today, `getDefaultCurrencyForCountry()` in `src/lib/payments/routing.ts` exists, but there's no storage layer on the `clients` table, no profile override UI, and no detection cascade for signed-in users.

**Detection cascade (full stack, not just pricing page):**
1. `cf-ipcountry` request header (Cloudflare, when behind it)
2. `x-forwarded-for` → server-side ipapi.co lookup (cached, silent fallback on failure)
3. `Intl.DateTimeFormat().resolvedOptions().timeZone` (client-side hint)
4. Default: US / USD

Resolved country + currency are captured **at signup** and stored on the `clients` record. Billable entities (subscriptions, invoices, coupons) inherit from the client's currency unless explicitly overridden.

User can change country/currency later in profile settings. Changing currency mid-subscription should show a confirmation: "New charges will be in [new currency] starting next billing period. Your current renewal on [date] will still be in [old currency]."

**Gateway routing follows country, not currency** — Kuwait users (KWD) route to MyFatoorah, India users (INR) route to Razorpay. If user switches country from KW → US, future renewals route to Razorpay instead.

## Checklist
- [x] Migration: `clients.country` (char 2) + `clients.currency` (char 3, default USD) already present in schema
- [x] Signup flow: capture browser timezone → country via `getBrowserTimezoneCountry()` and stash in `auth.users.user_metadata.signup_country` so client-creation trigger can hydrate `clients.country` + `clients.currency`
- [x] Server helper `resolveCountry(req)` in `src/lib/payments/routing.ts` — cf-ipcountry → x-vercel-ip-country → default US, returns `{ country, currency, source }`
- [x] Client helper `getBrowserTimezoneCountry()` — IANA timezone → ISO country map (~50 common zones)
- [x] Profile page: region card with country dropdown (grouped by region), currency shown read-only (auto-derived), Save action
- [x] When country changes: update `clients.country` + `clients.currency`, write `activity_log` entry (action `client.region_changed`, diff before/after)
- [x] Confirmation dialog on mid-subscription currency change explaining next-charge timing
- [x] Legacy rows (clients with no country) fall back to US/USD via `getDefaultCurrencyForCountry` — already the column default
- [x] All billing gateway picks via `getGatewayForCountry(clients.country)` — already wired in `src/lib/payments/routing.ts`

## Acceptance
- New user signs up from Kuwait → `clients.country='KW'`, `clients.currency='KWD'` automatically
- Existing user changes country in profile from US → KW → record updates, activity_log entry written, next invoice in KWD via MyFatoorah
- User with `cf-ipcountry=KW` but account set to country=US still sees USD prices and Razorpay gateway (account wins over headers)
- Signed-in user in a region with no Cloudflare header (direct connection) falls back through x-forwarded-for → timezone → default
- Unrecognized/empty country defaults to Razorpay/USD safely without throwing
