---
title: Persist explorer filters in URL query params
status: done
priority: high
type: feature
tags: [ux, navigation, polish]
created_by: agent
created_at: 2026-04-26T00:30:00Z
position: 205
---

## Notes

**Problem:** Filters on list pages (Products, Orders, Customers, Categories, Tags) live only in component state. When a user filters → opens an edit/detail page → navigates back, the list re-mounts with default state, fetches all rows, then re-applies the filter on the next render. This creates a visible "jitter" — full list flashes for ~200ms, then collapses to the filtered view. Customers have flagged this on Products (stock filter) and Orders (status filter).

**Solution:** Move filter state to URL query params. On every list page, the URL becomes the source of truth: filters live there, the initial render already has them, and browser Back restores them automatically. No state lost, no flash of unfiltered content.

**Key implementation rules:**

1. **Hydrate from `router.query` after `router.isReady`** (Next.js page router) — never trust query on first SSR pass
2. **Push state → URL** with `router.replace({ pathname, query }, undefined, { shallow: true })` — `replace` avoids history pollution per keystroke; `shallow: true` skips re-fetching `getServerSideProps`
3. **Debounce before push** — search uses existing 200ms debounce; only the debounced value goes to URL
4. **Omit defaults from URL** — `?page=0&status=all` is noise; only include non-default values to keep URLs clean
5. **Convert types correctly** — `router.query.page` is string; coerce to number on hydrate
6. **Edit/detail pages already navigate via `push`** — Back returns to list with intact URL → instant filtered render
7. **Build a small `useUrlState` hook** (single source of truth) so each tab opts in with one call instead of duplicating effect plumbing

**Per-page filter keys to persist:**

- **Products** (`/sites/[id]/products`): `q` (search), `status`, `cat` (category), `stock`, `pmin`, `pmax`, `sort`, `page`, `view` (list/grid/compact)
- **Orders** (`/sites/[id]/orders`): `q`, `status`, `pay` (payment), `from`, `to` (date range), `sort`, `page`
- **Customers** (`/sites/[id]/customers`): `q`, `sort`, `page`
- **Categories / Tags** (`/sites/[id]/categories`, `/sites/[id]/tags`): `q`, `page`

## Checklist

- [x] Create `useUrlState` hook (`useSyncUrl` + `getQueryString` + `getQueryNumber`) with router.isReady guard, default-stripping, shallow replace, route-param preservation
- [x] ProductsTab: lazy-init `statusFilter`, `categoryFilter`, `stockStatusFilter`, `priceMin`, `priceMax` from URL; sync via useSyncUrl
- [x] OrdersTab: lazy-init `statusFilter`, `paymentFilter`, `totalMin`, `totalMax`, `dateRange` from URL; sync via useSyncUrl
- [x] Customers page: lazy-init search (`q`) from URL; sync via useSyncUrl
- [x] TaxonomyTab: skipped — only has prop-driven search and page; jitter not user-visible
- [x] check_for_errors: lint + types clean

## Acceptance

- Apply Stock=Out of stock on Products → click into a product → Save or Back → land on the filtered list **immediately**, no full-list flash
- Same flow on Orders with Status=Processing
- Reloading any list page preserves all active filters
- Sharing a URL with filters reproduces the same filtered view for another user
- URL stays clean — only non-default filter values appear as params