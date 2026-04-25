---
title: Instant feedback on filter/sort/search/pagination
status: done
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

- [x] Layer 1: `<TopProgressBar />` component — 2px animated gradient bar pinned to top of data card, visible whenever a query is fetching
- [x] Layer 2: Search debounce 400→200ms (Products), 300→200ms (Orders); inline spinner inside search input right edge while fetching
- [x] Layer 3: Pagination arrows now disabled on `isFetching` (was only disabled during initial load) — prevents double-click and signals activity
- [x] Layer 4: Soft data dimming — `opacity-70 transition-opacity` on data area while `isFetching && !isLoading`
- [x] Applied uniformly to ProductsTab, OrdersTab, TaxonomyTab
- [x] Added `@keyframes progress-slide` to globals.css

## Acceptance

- Clicking any filter/sort/toggle/pagination shows immediate top-bar animation + data dimming within ~50ms
- Search feels responsive (200ms debounce + visible spinner)
- No logic regressions — query flow, cache, mutations untouched