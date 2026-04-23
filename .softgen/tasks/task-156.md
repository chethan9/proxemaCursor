---
title: Coupons (schema, admin CRUD, redemption, enforcement)
status: done
priority: medium
type: feature
tags: [billing, coupons, marketing]
created_by: agent
created_at: 2026-04-22T22:18:00Z
position: 156
---

## Notes
Promo codes for marketing, support comps, and partner deals. Applied at checkout and recorded on successful payment.

**Coupon types:**
- `percent` — N% off (value = 10 means 10%)
- `fixed` — N minor units off (currency-scoped if `currency` column set)
- `free_months` — full discount (treated as 100% off this invoice)

**Storage:** `billing_coupons` (separate from Woo `coupons` sync table) + `coupon_redemptions`. Unique index on `upper(code)` for case-insensitive lookup. One redemption per client per coupon enforced by unique `(coupon_id, client_id)` index.

**Flow:**
1. Frontend passes `couponCode` in `/api/billing/checkout`
2. Server calls `validateCoupon(code, planId, clientId, amount, currency)` → returns discount or rejection reason
3. Discount applied to amount before gateway charge; `subscriptions.pending_coupon_id` set
4. On successful `/api/billing/verify`, redemption row written + counter incremented via `increment_coupon_redemption_count()` RPC + `pending_coupon_id` cleared

## Checklist
- [x] `billing_coupons` table: code (unique upper), type (enum), value, currency (for fixed), plan_ids[] (null = all), max_redemptions, redemptions_count, expires_at, description, is_active, created_at
- [x] `coupon_redemptions` table with unique (coupon_id, client_id) — prevents double-use
- [x] RLS: public read active coupons, admin CRUD; redemptions readable to owning client + admins
- [x] Audit trigger on billing_coupons
- [x] `couponService.validateCoupon()` + `computeDiscount()` helpers (percent/fixed/free_months)
- [x] `/api/billing/coupons/validate` endpoint (POST, bearer-authed)
- [x] Checkout applies coupon: validates, computes discount, sets `pending_coupon_id` on subscription
- [x] Verify writes redemption + increments `redemptions_count` on successful charge (via `increment_coupon_redemption_count` RPC)
- [x] Prevent abuse: one redemption per (coupon, client) via unique index
- [ ] Admin `/settings/coupons` CRUD page — deferred (can insert via SQL for v1; UI nice-to-have)
- [ ] Billing page coupon input — deferred to task-154 expansion
- [ ] Renewal cron applies discount for each recurring invoice while recurring_months not exhausted — deferred to task-157 (cron owns renewal logic)
- [ ] Admin can manually apply a coupon to an existing subscription — deferred to task-155

## Acceptance
- POST `/api/billing/coupons/validate` with valid code returns `{ valid: true, coupon, discountMinor }`
- Same client submitting the same code twice returns `{ valid: false, reason: "Already redeemed" }`
- Coupon with `plan_ids: [growth_id]` rejects a checkout attempt on the Starter plan with `"Not valid for this plan"`
- Successful checkout with coupon writes exactly one `coupon_redemptions` row and increments `redemptions_count` by 1
- Expired / inactive / exhausted coupons rejected at validation time with clear reasons