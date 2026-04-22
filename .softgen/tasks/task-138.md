---
title: Fix site home dashboard stats to match WooCommerce analytics
status: done
priority: high
type: bug
tags: [dashboard, analytics, stats, rpc]
created_by: agent
created_at: 2026-04-22T02:00:00Z
position: 138
---

## Notes

The site Home dashboard (`src/pages/sites/[id]/home.tsx`) shows revenue and order counts that don't match the WooCommerce Analytics → Overview page for the same date range.

**Observed discrepancy (todoo site, 30-day window):**
| Metric | Our dashboard | WooCommerce | Gap |
|---|---|---|---|
| Revenue / Net sales (30d) | 715.5 KWD | 650 KWD | +10% |
| Orders (30d) | 23 | 22 | +1 |

**Root cause (hypothesis):** Our RPC `get_site_home_stats` likely uses `orders.total` (gross — includes tax + shipping + fees) and counts ALL order statuses. WooCommerce's "Net sales" excludes tax/shipping/refunds and only counts revenue-generating statuses (typically `completed` and `processing`).

**Investigation needed:**
1. Call `execute_sql_query` with `SELECT pg_get_functiondef('public.get_site_home_stats'::regproc);` to see the current RPC source.
2. Compare its revenue calculation to WooCommerce's net-sales formula.

**Fix direction (apply inside the RPC):**
- Revenue / sales figures (`sales_today`, `sales_week`, `sales_month`, `sales_prev_month`, `daily[].revenue`) should use: `COALESCE(subtotal, 0) - COALESCE(discount_total, 0)` — i.e., net of tax, shipping, and discounts, matching WooCommerce's Net sales formula. Alternative if subtotal is missing: `total - total_tax - shipping_total`.
- Only count orders where `status IN ('completed', 'processing')` for all revenue-producing metrics. `orders_today`, `orders_in_progress`, `orders_month_count`, and `orders_total` should follow the same filter so the numbers are consistent.
- Keep `order_status_breakdown` showing ALL statuses (that panel is supposed to show the distribution).
- Ensure `date_created` (not `created_at`) is used for day-window filtering — `created_at` is the sync timestamp, not the actual order time.

**Files involved:**
- Postgres function: `public.get_site_home_stats(p_store_id uuid, p_tz text)` — edit via `execute_sql_query` with `CREATE OR REPLACE FUNCTION ...`
- Consumer: `src/services/siteStatsService.ts` (no changes expected unless response shape changes)
- UI: `src/pages/sites/[id]/home.tsx` + `src/components/site/home/*.tsx` (no changes expected)

**Testing:**
After updating the RPC, reload the Home page for `todoo` and confirm the numbers match WordPress → WooCommerce → Analytics → Overview (Mar 22 – Apr 22 window). Also verify another site to make sure the fix generalizes.

## Checklist

- [ ] Retrieve current RPC source for `get_site_home_stats` and document its sales formula
- [ ] Rewrite revenue calculations inside the RPC to use net sales (`subtotal - discount_total` or `total - total_tax - shipping_total`)
- [ ] Filter order counts for revenue metrics to `status IN ('completed', 'processing')` only
- [ ] Use `orders.date_created` (not `created_at`) for all day/week/month windowing
- [ ] Keep `order_status_breakdown` across all statuses for the donut chart
- [ ] Verify updated numbers match WooCommerce Analytics for the todoo site over 30d
- [ ] Verify another site (beam or thedcart) also matches within a reasonable margin

## Acceptance

- The 5-card stat strip (Today / In Progress / Today Sales / Weekly Sales / Monthly Sales / Avg Order) matches WooCommerce's Net sales and order counts for the same window (within 1-2 KWD rounding).
- The Revenue sparkline tile delta-percentage reflects net-sales comparison, not gross.
- No changes to the frontend response shape — cards still render correctly.