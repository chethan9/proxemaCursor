---
title: Uptime monitoring v1
status: todo
priority: high
type: feature
tags: [uptime, monitoring, cron, site-health]
created_by: agent
created_at: 2026-04-22
position: 136
---

## Notes

Track site uptime over time and surface it in the product so agencies have evidence, history, and a foundation for future alerting.

**Data model:**
- New table `uptime_checks`:
  - `id` uuid PK
  - `store_id` uuid FK → stores.id (ON DELETE CASCADE)
  - `checked_at` timestamptz (default now, indexed)
  - `ok` boolean
  - `response_ms` int
  - `status_code` int nullable
  - `error` text nullable
- Index on `(store_id, checked_at DESC)` for fast time-range queries
- RLS: super admin sees all, client users see only their client's sites (match existing stores policy pattern)

**Cron:**
- New endpoint `src/pages/api/cron/uptime-check.ts` scheduled every 5 minutes via Vercel cron (`vercel.json`)
- Per invocation: fetch all active sites (`sync_enabled = true` or no disabled flag), fire a lightweight HEAD/GET to `{url}/wp-json/` with 8s timeout
- Parallelism cap of 10 concurrent requests to avoid runaway
- Insert one `uptime_checks` row per site per tick
- Keep invocation under the 50s serverless budget — resume via offset if > N sites

**UI surfaces:**

1. **Site card sparkline** (fills the placeholder reserved in task 135):
   - 24h sparkline of ok/not-ok per 5-min bucket
   - Color: emerald healthy, amber if 1-5 failures in 24h, rose if >5 or currently down
   - Hover tooltip: "Uptime 99.8% • Last down 2h ago"

2. **Site home page widgets** (`src/pages/sites/[id]/home.tsx`):
   - Statuspage-style 90-day bar (1 bar per day, green/amber/rose)
   - Uptime % stat card for 24h / 7d / 30d / 90d
   - Total downtime stat ("Down for 12m total in last 30d")
   - Average response time card with trend arrow
   - Current status banner: "Operational" / "Degraded — 3 failed checks in last hour" / "Down — last successful check 25m ago"

3. **Uptime detail view** (`src/pages/sites/[id]/uptime.tsx`, new page):
   - Time range tabs (24h / 7d / 30d / 90d / Custom)
   - Response time line chart
   - Incident list (grouped consecutive failures with start/end/duration)
   - CSV export of raw checks for current range
   - Link from site home widget to this detail view

**Performance & retention:**
- Storage projection: 5min × 288/day × 100 sites = ~29k rows/day, ~10M rows/year — OK for Postgres with the index, plan aggregation in v2
- Add a placeholder cleanup cron (`uptime-retention.ts`) that deletes checks older than 90 days — enable later when data volume demands

**Out of scope for v1 (explicitly):**
- Alerting (email/webhook on downtime)
- Public status page for clients
- Aggregation buckets (hourly/daily rollups)
- Custom check endpoints beyond `/wp-json/`

## Checklist

- [ ] Migration: create `uptime_checks` table with FK, indexes, RLS matching stores
- [ ] Cron endpoint `uptime-check.ts` pings all active sites every 5 minutes with 8s timeout and concurrency cap
- [ ] Register the cron in `vercel.json` on a 5-minute schedule
- [ ] Service `src/services/uptimeService.ts`: fetch checks by store + range, compute uptime %, compute response-time averages, group incidents
- [ ] Query hook `src/hooks/queries/useUptime.ts` (24h, 7d, 30d, 90d ranges)
- [ ] Uptime sparkline component for site card (24h, 1 bucket per 5 min)
- [ ] 90-day status bar widget on site home (1 bar per day, green/amber/rose, hover shows that day's uptime %)
- [ ] Uptime % stat cards (24h / 7d / 30d / 90d) on site home
- [ ] Total downtime + average response time cards on site home
- [ ] Current status banner on site home
- [ ] New page `/sites/[id]/uptime` with time range tabs, response time line chart, incident list
- [ ] CSV export of raw checks for current range
- [ ] Link from site home uptime widgets to detail page
- [ ] Placeholder retention cron `uptime-retention.ts` (inactive until enabled)

## Acceptance

- Within 30 minutes of deploy, each active site has ≥6 `uptime_checks` rows
- Site card shows a live 24h sparkline; down periods render amber/rose
- Site home page shows the 90-day status bar + uptime % cards + current status banner
- Clicking into the uptime detail page shows response time chart and incident list for the selected range
- CSV export returns the full row set for the chosen time range