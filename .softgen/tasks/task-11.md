---
title: Add site health score system + dashboard health indicators
status: todo
priority: medium
type: feature
tags: [monitoring, dashboard]
created_by: agent
created_at: 2026-04-17T21:50:00Z
position: 11
---

## Notes
Each site needs a computed health score (0-100) that surfaces problems quickly. Score factors:
- Sync freshness (25 pts): 100 if synced < interval, 0 if overdue by 2x interval
- Sync success rate (25 pts): % successful of last 10 sync runs
- Webhook health (25 pts): % active webhooks + recent event reception
- API connectivity (25 pts): can reach WooCommerce API (ping test)

Compute on: after each sync, on manual trigger, via cron every 15 min.
Cache in `stores.health_score` column for fast dashboard queries.

Dashboard needs: overall fleet health, list of sites needing attention, failed syncs in last 24h, webhook events/hour chart.

## Checklist
- [ ] Create `src/lib/health-score.ts` with `computeSiteHealth(storeId)` function - returns { score, factors: {sync, success_rate, webhooks, connectivity}, issues: string[] }
- [ ] Call computeSiteHealth at end of sync in sync-scheduler.ts and sync.ts - update stores.health_score and health_checked_at
- [ ] Create `/api/cron/health-check` endpoint that runs computeSiteHealth for all stores - register in vercel.json cron (every 15 min)
- [ ] Add health score badge in sites list page (src/pages/sites/index.tsx) - green >= 80, amber 50-79, red < 50
- [ ] Add health score card at top of site detail page showing breakdown of 4 factors with progress bars
- [ ] Add "Issues" list on site detail page showing problems (e.g., "Webhook 'product.created' failed 3 times", "Last sync 4h ago, interval is 1h")
- [ ] Update dashboard (src/pages/index.tsx): add fleet health summary card (avg health, X sites healthy, Y need attention)
- [ ] Add "Sites Needing Attention" section on dashboard - list of sites with score < 80, sorted ascending
- [ ] Add webhook events per hour line chart on dashboard (last 24h)
