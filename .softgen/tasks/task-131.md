---
title: Persist user view preferences across explorer tabs
status: todo
priority: high
type: chore
tags: [ux, preferences, explorer, products, orders, customers, taxonomy]
created_by: agent
created_at: 2026-04-21T21:45:00Z
position: 131
---

## Notes

Column visibility, column order, sort, filters, page size, and view mode currently reset on refresh for most users because each explorer tab rolls its own persistence logic with gaps.

**Problems in the existing code:**
- `src/components/explore/ProductsTab.tsx` and `src/components/explore/OrdersTab.tsx` each read localStorage on mount for *some* prefs (pageSize, viewMode, columnOrder) but not for `visibleCols` — column show/hide toggles are only pushed to Supabase, never cached locally.
- The remote Supabase fetch inside each tab skips entirely when *any* localStorage key is present, so `visibleCols` saved remotely never rehydrates if the user has ever changed page size locally.
- Customers page (`src/pages/sites/[id]/customers.tsx`) has its own column/sort state with no persistence at all.
- Categories/Tags (`src/components/explore/TaxonomyTab.tsx`) same — no persistence.
- The `useViewPreferences` hook at `src/hooks/useViewPreferences.ts` already solves this correctly (localStorage for fast paint + Supabase as source of truth, debounced writes) but isn't used anywhere.

**Goal:** Every explorer surface uses `useViewPreferences` with a stable `view_key`, so a user's column choices, sort, filters, page size, and view mode follow them across sessions and devices.

**Persisted fields per tab:**
- Products: `columnOrder`, `visibleCols`, `pageSize`, `viewMode`, `sort`, `statusFilter`, `excludeOutOfStock`, `categoryFilter`, `stockStatusFilter`
- Orders: `columnOrder`, `visibleCols`, `pageSize`, `sort`, `statusFilter`, `paymentFilter`, `dateRange` (preset key only, not absolute custom dates)
- Customers: `columnOrder`, `visibleCols`, `pageSize`, `sort`
- Taxonomy (categories + tags): `pageSize`, `sort`, any column toggles

**Non-persisted (deliberately):** search text, selected row IDs, expanded row, page number, custom date from/to (absolute dates shouldn't stick across sessions).

**View keys to use:** `products`, `orders`, `customers`, `categories`, `tags` — simple and shared across all sites for that user (prefs are not per-site, they're per-user-per-view).

**Behavior:** On mount, paint instantly from localStorage if present. Always fetch remote in background and merge — remote wins if it's newer or if localStorage is empty. Debounce Supabase writes by ~800ms so dragging columns doesn't hammer the DB.

## Checklist

- [ ] Refactor Products explorer to drive column visibility, column order, page size, view mode, sort, and all filter controls through a single `useViewPreferences("products", defaults)` call — drop the ad-hoc localStorage reads and the manual `savePreferences` effect.
- [ ] Refactor Orders explorer the same way with `useViewPreferences("orders", defaults)` covering columns, sort, status filter, payment filter, page size, and date range preset.
- [ ] Wire Customers page columns, sort, and page size through `useViewPreferences("customers", defaults)` — new persistence, currently has none.
- [ ] Wire Categories tab and Tags tab through `useViewPreferences("categories", defaults)` and `useViewPreferences("tags", defaults)` for page size, sort, and any toggles they expose.
- [ ] Ensure remote Supabase fetch always runs on mount (not conditionally on localStorage absence), and merges into state so prefs sync across devices; keep localStorage as the fast-paint cache only.
- [ ] Add a "Reset to defaults" affordance in each tab's Columns popover that clears both the local cache and the remote row for that view key, then reloads defaults.

## Acceptance

- Toggling column visibility, reordering columns, changing page size, or switching sort on Products/Orders/Customers persists across a full browser refresh and across a different browser logged into the same account.
- On a device with no localStorage, the user sees their last-saved preferences from Supabase within one render, not the hardcoded defaults.
- Clicking "Reset to defaults" in any tab returns columns/sort/page size to the hardcoded defaults and the change sticks after refresh.
