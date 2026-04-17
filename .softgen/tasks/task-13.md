---
title: Redesign Sync Engine UI + add sync test / dry-run feature
status: todo
priority: medium
type: feature
tags: [ui, sync]
created_by: agent
created_at: 2026-04-17T21:50:00Z
position: 13
---

## Notes
Current sync UI has play-button grid which user doesn't like. Also needs:
- Single clean "Sync All" flow with unified progress bar (already partially done but needs polish)
- Per-aspect sync option in a dropdown (not individual cards)
- Sync test / dry-run: fetches first page from WooCommerce but doesn't write to DB - reports what would change
- Live status update (no page refresh blinking)

Fix the re-render/blinking issue by using SWR or react-query pattern: fetch once, cache, only re-fetch specific sync runs via polling during active sync.

## Checklist
- [ ] Install swr: `npm install swr`
- [ ] Create `src/hooks/useSiteData.ts` using SWR - replaces manual state + cache, handles stale-while-revalidate automatically
- [ ] Redesign Sync Engine tab: top row = 5 stat tiles (Products, Orders, Customers, Categories, Tags, Coupons) with count + last sync time, no buttons
- [ ] Add action bar above tiles: [Sync All Data] button + [dropdown: Sync Specific Aspect] + [Sync Test (Dry Run)] button
- [ ] Unified progress bar below action bar shown only during sync - single bar showing aspect progress (not 6 separate spinners)
- [ ] Create POST `/api/stores/[storeId]/sync-test` endpoint - fetches first page of each aspect from WooCommerce, compares with DB, returns { would_create, would_update, would_skip } counts without writing
- [ ] Show dry-run results in a dialog with summary before user confirms actual sync
- [ ] Fix blinking: extract sync history into separate SWR hook that only re-fetches during active sync (poll 2s), otherwise cached
- [ ] Add "Aspect" dropdown in sync action bar allowing user to sync just one aspect (calls sync endpoint with ?aspect=products query param)
