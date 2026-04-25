---
title: Instant feedback on filter/sort/search/pagination
status: in_progress
priority: high
type: feature
tags: [ui, ux, polish, performance-perception]
created_by: agent
created_at: 2026-04-25T23:30:00Z
position: 202
---

## Notes

User feedback: the explore tabs (Products, Orders, Taxonomy) feel laggy because clicks on filters, sort, search, pagination, and toggles produce no visible response until the network fetch completes. Cause: `keepPreviousData` keeps old data frozen on screen during refetch with no indicator that something is happening.

Solution: 4 layers of perceived-performance polish (no logic changes).

## Checklist

- [x] Layer 1: Create `<TopProgressBar />` component — 2px animated bar pinned to top of data card, visible whenever a query is fetching
- [ ] Layer 2: Reduce search debounce 400ms → 200ms; add inline spinner inside search input right edge while fetching
- [ ] Layer 3: Disable pagination arrows while fetching (currently only disabled during initial load); add subtle pressed-state ring on filter pills
- [ ] Layer 4: Soft data dimming — wrap data area in `opacity-70 transition-opacity` while `isFetching && !isLoading`
- [ ] Apply all 4 layers uniformly to ProductsTab, OrdersTab, TaxonomyTab
- [ ] Add `@keyframes progress-slide` to globals.css for the moving bar animation

## Acceptance

- Clicking any filter/sort/toggle/pagination shows immediate top-bar animation + data dimming within ~50ms
- Search feels responsive (200ms debounce + visible spinner)
- No logic regressions — query flow, cache, mutations untouched