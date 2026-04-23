---
title: Coupons (schema, admin CRUD, redemption, enforcement)
status: in_progress
priority: medium
type: feature
tags: [billing, coupons, marketing]
created_by: agent
created_at: 2026-04-22T22:18:00Z
position: 156
---

## Notes
Promo codes for marketing, support comps, and partner deals. Applied at checkout and at every subsequent renewal for as long as the coupon terms allow.

**Coupon types:**
- `percent` — 25% off, applied to each renewal until `recurring_months` exhausted
- `fixed` — KWD 5 off each renewal for N months
- `free_months` — skip N renewal charges entirely (invoice generated at zero, no gateway call)

**Scoping:** coupon can apply to any plan (default), or restrict to a specific plan list. Stack rules: only one coupon active per subscription at a time.

## Checklist
- [ ] `coupons` table: id, code (unique uppercase), type, value (numeric, meaning depends on type), recurring_months (null = one-time, N = applies to N consecutive renewals), max_redemptions, redemption_count, applicable_plan_ids (uuid[] or null for all), valid_from, valid_until, is_active, created_by, created_at
- [ ] `coupon_redemptions` table: id, coupon_id, client_id, subscription_id, redeemed_at, applied_to_invoice_ids (uuid[])
- [ ] Admin `/admin/coupons` page: CRUD, usage stats (redeemed N/100), "generate N unique codes" batch action for campaigns
- [ ] Validation endpoint `/api/billing/coupons/validate?code=X&planId=Y` returns { valid, reason, discount_preview }
- [ ] Checkout applies coupon: creates coupon_redemption row, stores coupon_id on subscription for future renewal ref
- [ ] Renewal cron applies discount for each invoice while recurring_months not exhausted; auto-removes from subscription when done
- [ ] Prevent abuse: one redemption per client per coupon code
- [ ] Admin can manually apply a coupon to an existing subscription (writes activity_log with reason)

## Acceptance
- Creating coupon WELCOME25 (25% for 3 months) and applying at checkout produces 3 consecutive discounted invoices, then full price on 4th renewal
- Using the same code twice on the same client shows "Already redeemed"
- Coupon restricted to Growth plan rejects attempts on Starter / Scale at validation time
- Deactivating a coupon stops new redemptions but lets existing recurring applications continue until term ends