---
title: Site home dashboard (/sites/[id]/home)
status: done
priority: high
type: feature
tags: [dashboard, performance, site]
created_by: agent
created_at: 2026-04-21T17:35:00Z
position: 121
---

## Notes

Build a per-site home dashboard with stat strip, charts, and tables. Replace the "Coming Soon" placeholder at `src/pages/sites/[id]/home.tsx`.

**No fake data rule:** The mirror DB has NO visitor analytics / session / device data. We will NOT include Visitors Today, Visitors Overview, or Sessions By Device widgets. Every card on this page must be backed by real data in the `orders` / `products` / `customers` tables for the current `store_id`.

**Stats we compute from DB (per store_id, excluding `cancelled`, `refunded`, `failed`, `trash` unless otherwise stated):**

From `orders`:
- Orders Today (count, date_created ≥ today 00:00)
- Orders in Progress (status in: pending, processing, on-hold)
- Today Sales = SUM(total) today
- Weekly Sales = SUM(total) last 7d
- Monthly Sales = SUM(total) last 30d
- Avg Order Value (30d) = monthly_sales / monthly_order_count
- Daily series (30d) — for each day: orders count + revenue total
- Order Status Breakdown (30d, INCLUDING cancelled/refunded for completeness) — count per status
- Recent Orders (last 10, with line_items thumbnails, status, total, date)
- Top Products (last 30d aggregate over `line_items` jsonb) — name, image, units sold, revenue (top 10)

**Performance strategy — single RPC, single round-trip:**

Create ONE Postgres function `get_site_home_stats(p_store_id uuid, p_tz text DEFAULT 'UTC')` returning a single JSON blob with every number above. Uses `FILTER (WHERE ...)` clauses for parallel aggregations in ONE pass over orders, + one CTE unrolling `line_items` for Top Products. Existing index `orders(store_id, date_created DESC)` covers it.

React Query wrapper: `staleTime: 60_000`, `refetchOnWindowFocus: false`. Manual "Refresh" button triggers `queryClient.invalidateQueries`. Expected: 1 network call per page load, ~100-300ms.

**Currency:** Use `store.currency` (default "KWD") for all money displays.

**Layout:**
- **Header:** title "Home", store name + URL subtitle, "Refresh" button (right).
- **Row 1 — 6-card stat strip:** Orders Today · Orders in Progress · Today Sales · Weekly Sales · Monthly Sales · Avg Order Value (30d). All currency values respect store currency. Mobile: wraps to 2-col.
- **Row 2 — 3 cards:**
  - **Sales Trend (30d)** (left, 2 cols wide): line/area chart — daily revenue line + daily order count as secondary axis. Tooltip on hover showing date + exact values.
  - **Order Status Breakdown (30d)** (right, 1 col): donut chart with center total order count. Legend below with status pills (processing/completed/on-hold/pending/cancelled/refunded) using the existing `StatusBadge` colors + counts.
- **Row 3 — 2 cards:**
  - **Sales card** (small tile): large total of last 30d + mini sparkline + "X of Y orders" subtext.
  - **Revenue card** (small tile): large total in currency + mini sparkline + delta vs previous 30d period (optional stretch).
- **Row 4 — 2 cards:**
  - **Recent Orders** (left 2/3): last 10 — status pill, order number, date, product thumbnails with qty badge, total. Row click → navigate to that order detail.
  - **Top Products** (right 1/3): last 30d — thumb + product name, units sold, revenue. Row click → product edit page.

**Empty states:**
- Zero orders ever → replace all charts with single empty card: "No orders yet. Your dashboard will populate automatically once the first order arrives."
- Some cards may legitimately show zeros (e.g. Today Sales = 0 on a quiet day) — that's fine, just render 0.

**Files to touch:**
- `src/pages/sites/[id]/home.tsx` — rewrite placeholder
- New: `src/components/site/home/StatStrip.tsx`
- New: `src/components/site/home/SalesTrendCard.tsx`
- New: `src/components/site/home/OrderStatusDonut.tsx`
- New: `src/components/site/home/SalesTile.tsx`
- New: `src/components/site/home/RevenueTile.tsx`
- New: `src/components/site/home/RecentOrdersCard.tsx`
- New: `src/components/site/home/TopProductsCard.tsx`
- New: `src/services/siteStatsService.ts`
- New: `src/hooks/queries/useSiteStats.ts`
- Migration: `get_site_home_stats` Postgres function (SECURITY INVOKER so RLS applies)

Use `recharts` for charts (already available through shadcn). Loading skeletons per card, not a full-page spinner.

## Checklist

- [ ] Postgres RPC `get_site_home_stats(store_id, tz)` returning one JSON blob with all aggregations computed in a single query
- [ ] 6-card stat strip: Orders Today, Orders in Progress, Today Sales, Weekly Sales, Monthly Sales, Avg Order Value (30d) — all currency in store currency
- [ ] Sales Trend (30d) line/area chart — daily revenue + daily order count, with hover tooltip showing date and exact values
- [ ] Order Status Breakdown donut (30d) — center shows total order count, legend lists each status with count + color matching StatusBadge
- [ ] Sales tile: last-30d total, mini sparkline, order-count subtext
- [ ] Revenue tile: last-30d currency total, mini sparkline, optional delta vs previous 30d
- [ ] Recent Orders card: 10 most recent — status pill, order number, date, line-item thumbnails with qty badges, total; row click navigates to order
- [ ] Top Products card: 10 best sellers (30d) — thumbnail, name, units sold, revenue; row click navigates to product edit
- [ ] Header Refresh button that invalidates the stats query
- [ ] React Query: 60s staleTime, refetchOnWindowFocus disabled, one network request per page load (verifiable in DevTools)
- [ ] Per-card loading skeletons (not full-page spinner)
- [ ] Empty state when site has zero orders ever — single friendly card replacing the data area
- [ ] Mobile responsive: stat strip wraps 2-col, chart row stacks vertically

## Acceptance

- Opening `/sites/[id]/home` for a site with orders shows real numbers that match a manual SQL count.
- Every widget on the page is backed by real DB data — no fabricated/placeholder numbers anywhere.
- Exactly ONE RPC call fires on page load (verifiable in Network tab).
- Switching between two sites updates all numbers correctly with no cross-site data leak.
- Refresh button re-fetches within ~300ms typical.