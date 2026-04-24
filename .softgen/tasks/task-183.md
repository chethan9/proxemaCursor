---
title: Multi-currency dashboard fix for site home
status: done
priority: high
type: bug
tags: [dashboard, currency, rpc, site-home]
created_by: agent
created_at: 2026-04-24T05:30:00Z
position: 183
---

## Notes

**Bug**: Site home dashboard (`/sites/[id]/home`) sums monetary values across all order currencies and stamps the total with a single currency symbol. A store with KWD + USD + SAR orders shows `KWD + USD + SAR` added together, labeled as KWD. This affects:
- Stat strip: "Today Sales", "Weekly Sales", "Monthly Sales", "Avg Order (30d)"
- Sales trend chart (30d daily revenue line)
- Top products card (revenue ranking)
- Sparkline revenue tile + vs-previous-period delta

**Files**:
- RPC: `supabase/migrations/20260422030500_site_home_stats_rpc.sql` — every `SUM(total - total_tax - shipping_total)` is currency-agnostic
- Page: `src/pages/sites/[id]/home.tsx` — passes `store.currency` as the single label
- Service: `src/services/siteStatsService.ts` — call signature needs a currency param
- Hook: `src/hooks/queries/useSiteStats.ts` — cache key needs currency dimension
- Components: `StatStrip.tsx`, `SalesTrendCard.tsx`, `SparklineTile.tsx`, `TopProductsCard.tsx`, `RecentOrdersCard.tsx` (already per-order currency, fine)

**Approach** (accurate, no FX conversion):
- RPC returns the list of currencies found in the last 30d (ordered by frequency) as a new `currencies` array in the response, plus the effective currency used for the aggregations.
- RPC accepts `p_currency text default null`; when null, picks the most-used 30d currency, falling back to `stores.currency` when the site has zero orders.
- All monetary SUMs get an `AND currency = v_currency` predicate, including the daily trend CTE and top-products CTE.
- Order-count stats (`orders_today`, `orders_in_progress`, `orders_month_count`, `orders_total`) remain currency-agnostic — these are counts, not money. UI labels stay as-is.
- UI shows a compact currency switcher (pill/segmented control) at the top-right of the stat strip **only when `currencies.length > 1`**. Switcher updates the selected currency, which flows into the query key and triggers a refetch.
- Selected currency persists in `?currency=USD` URL param so refresh/share preserves the view.
- Empty-state copy when a currency has zero orders in the period (e.g. "No sales in USD in the last 30 days").

**Non-goals**: FX conversion, combined-currency totals, historical currency totals beyond 30d.

## Checklist

- [x] Update `get_site_home_stats` RPC to accept optional currency filter and return list of currencies detected in last 30d plus the effective currency used
- [x] RPC: default selected currency to most-used in last 30d, falling back to the store's configured currency when there are no orders
- [x] RPC: apply currency filter to all monetary aggregations (today/week/month sales, previous-month sales, daily trend revenue, top products revenue) while leaving order-count stats currency-agnostic
- [x] Extend stats service response shape with `currencies: string[]` and `currency: string` (effective)
- [x] Extend stats hook + service call signature to pass a selected currency; include it in the query cache key so switching refetches
- [x] Add compact currency switcher UI on the site home page, shown only when more than one currency is detected; default to the effective currency returned by the RPC
- [x] Persist selected currency in a `?currency=` URL query param so refresh/share preserves the view
- [x] Show an inline empty-state inside monetary cards when the selected currency has zero orders in the period (keep order-count cards populated)
- [x] Update the stat strip to display the effective currency label consistently across all monetary tiles and the sparkline revenue tile
- [x] Verify recent orders card continues to display per-order currency (no regression — it already renders each order's own currency)
- [x] Smoke-test single-currency store (no switcher shown, numbers unchanged) and multi-currency store (switcher appears, switching recomputes all monetary values)

## Acceptance

- On a single-currency store, the site home looks identical to before (no switcher, same totals).
- On a store with orders in more than one currency, a currency switcher appears near the top; switching currencies updates every monetary value and chart on the page to that currency only.
- Order-count stats ("Orders Today", "Orders in Progress", "orders last 30d" sparkline) remain unchanged when switching currency because they count rows regardless of currency.