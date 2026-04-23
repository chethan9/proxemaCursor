---
title: Plans + quotas + multi-currency pricing (schema, admin CRUD, enforcement helpers)
status: done
priority: urgent
type: feature
tags: [billing, plans, admin, currency, platform]
created_by: agent
created_at: 2026-04-22T22:11:00Z
position: 149
---

## Notes
Defines what a customer can buy and what each tier lets them do. Ships before subscriptions so subscriptions can reference plans.

**Quota model:** typed columns for well-known limits (max_sites, max_products_per_site, max_users, max_api_calls_per_month) + jsonb `features` for boolean flags. Quotas are hard limits enforced at the API layer; features are soft flags the UI reads to show/hide capabilities.

**Multi-currency pricing:** instead of a single `price_cents` column, each plan stores a `prices` jsonb map:
```
{ "USD": 2900, "INR": 240000, "KWD": 900, "SAR": 11000, "AED": 11000 }
```
Values are in the smallest currency unit (cents / paise / fils). This is **localized pricing**, not FX conversion — Indian customers see ₹2400/mo, US customers see $29/mo, Kuwaiti customers see 9 KWD/mo. Admin sets explicit values per region.

Only currencies supported by the gateway serving that country should appear. Admin UI validates against `gateway.supportedCurrencies()` from task-150.

**Tiers to seed for launch:** Starter, Growth, Scale, Enterprise. Enterprise is "contact us" (prices null per currency, flagged as custom).

**Enforcement philosophy:** Block at create/write path, not at read. A customer over quota can still view everything they own; they just can't add more. Clear error messages with an "Upgrade" CTA.

## Checklist
- [x] `plans` table: id, name, slug (unique), description, `prices` (jsonb — currency → smallest-unit integer), billing_interval (month/year), max_sites, max_products_per_site, max_users, max_api_calls_per_month, features (jsonb), trial_days, is_active, is_custom (true = contact sales), sort_order, created_at, updated_at
- [x] Seed four plans (Starter / Growth / Scale / Enterprise) with prices in USD, INR, KWD, SAR, AED and realistic quotas
- [x] Admin page `/settings/plans` (super-admin only): list, create, edit, archive plans; drag-to-reorder; per-currency price editor validated against gateway support
- [x] Live pricing-card preview on plan editor shows how the plan renders in each currency
- [x] `lib/quota.ts` helpers: getClientQuota(clientId), getCurrentUsage(clientId), canAddSite(clientId), canAddProduct(clientId, siteId), canAddUser(clientId), getRemainingApiCalls(clientId), getPlanPrice(plan, currency)
- [x] `getPlanPrice(plan, currency)` returns null if the plan has no price for that currency — triggers "contact sales" fallback
- [x] Wire canAddSite into site create API; return 402 Payment Required with quota context if blocked
- [x] Wire canAddProduct into product create API; same 402 response
- [x] Quota-tripped errors include: current usage, plan limit, upgrade URL — UI surfaces this in a toast with "Upgrade" button
- [x] Monthly API call counter increments on every `/api/v1/*` hit; resets at subscription period boundary

## Acceptance
- Admin creates a new plan with USD + INR + KWD prices; trying to set an RUB price is blocked because no configured gateway supports it
- Customer in India viewing pricing sees ₹2400/mo; customer in Kuwait sees 9 KWD/mo; customer in US sees $29/mo — same plan, different displays
- Customer on Starter plan trying to create a 2nd site sees toast "Your plan allows 1 site — upgrade to Growth for 3 more"
- Customer on Growth plan at 9,998 products creating a 10,000th product via API gets clean 402 with { error, currentUsage, limit, upgradeUrl }