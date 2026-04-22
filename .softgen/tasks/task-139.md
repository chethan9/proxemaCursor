---
title: Fix site home "No orders yet" on production
status: todo
priority: urgent
type: bug
tags: [home, rpc, migration, error-handling]
created_by: agent
created_at: 2026-04-22T03:05:00Z
position: 1
---

## Notes

**Bug:** On production (`tryapp.cc`), `/sites/[id]/home` shows "No orders yet" for stores that clearly have orders (e.g. store `623ea4e6-...` has 266 orders visible on `/orders` page but home shows empty state).

**Root cause:**
1. The RPC `get_site_home_stats` was created via `execute_sql_query` against the dev DB but **no migration file exists** for it (`grep get_site_home_stats supabase/migrations/*.sql` returns nothing). Several recent migrations in `supabase/migrations/` are 0 bytes, suggesting migration files weren't persisted. Production DB does not have this function.
2. `src/pages/sites/[id]/home.tsx` uses `showEmpty = !storeLoading && !isLoading && !hasAnyData` where `hasAnyData = s && s.orders_total > 0`. When the RPC call fails (missing function, network error), `data` is undefined → `s` undefined → `hasAnyData` false → renders "No orders yet", masking the real failure.
3. `src/hooks/queries/useSiteStats.ts` exposes `isLoading`/`isFetching` but the page never reads or surfaces `error`.

**Files involved:**
- `src/services/siteStatsService.ts` (calls RPC `get_site_home_stats`)
- `src/hooks/queries/useSiteStats.ts`
- `src/pages/sites/[id]/home.tsx` (empty-state logic masks errors)
- `supabase/migrations/` (missing file for the RPC)

**RPC signature expected by client** (`SiteStatsResponse` in `src/services/siteStatsService.ts`):
- `stats`: orders_today, orders_in_progress, sales_today, sales_week, sales_month, orders_month_count, sales_prev_month, orders_total
- `daily`: [{ day, orders, revenue }] (last 30 days)
- `status_breakdown`: [{ status, count }] (last 30 days)
- `recent_orders`: 10 most recent with id, woo_id, order_number, status, total, currency, date_created, line_items, billing
- `top_products`: top 10 by units in last 30d with product_id, name, units, revenue, image, local_id
- Takes `p_store_id uuid, p_tz text` and returns `jsonb`.

The function already exists in dev DB — dump its current definition with `SELECT pg_get_functiondef(...)` and save that exact SQL as the new migration file so prod matches dev.

**Empty-state rule (new):**
- On query `error` → show error alert card with retry button (not "No orders yet")
- On successful response with `orders_total === 0` → show "No orders yet"
- Otherwise → show dashboard

## Checklist

- [x] Dump current `get_site_home_stats` function definition from dev DB and save as new timestamped migration file in `supabase/migrations/` so production gets the function on next deploy
- [x] Verify migration file is non-empty and contains complete `CREATE OR REPLACE FUNCTION` body (guard against the 0-byte migration issue)
- [ ] Audit other recent 0-byte migration files in `supabase/migrations/` and re-capture their SQL from dev DB if they correspond to functions/views/policies still in use
- [x] Update `src/hooks/queries/useSiteStats.ts` to return `error` alongside `data`/`isLoading`
- [x] Update `src/pages/sites/[id]/home.tsx` empty-state logic: show error card with retry when `error` present, only show "No orders yet" when query succeeded and `orders_total === 0`
- [x] Error card should show a short human-readable message (e.g. "Unable to load dashboard stats") with a retry button that invalidates the query
- [ ] Manually verify on dev: force an error (e.g. pass bad store id) → see error card, not "No orders yet"

## Acceptance

- Deploying to production restores the home dashboard for stores that have orders.
- When the RPC fails, users see an error card with retry — never a false "No orders yet".
- "No orders yet" appears only when the store genuinely has zero orders."