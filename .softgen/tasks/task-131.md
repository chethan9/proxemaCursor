---
title: Persist user view preferences across explorer tabs
status: done
priority: high
type: chore
tags: [ux, persistence, preferences]
created_by: agent
created_at: 2026-04-21
position: 131
---

## Notes
Column visibility, column order, sort, page size, and filters reset every reload. `viewPreferencesService` + `user_view_preferences` table already exist but aren't wired consistently — `visibleCols` isn't cached to localStorage and the remote fetch is skipped whenever any other localStorage key exists. Fix: unify persistence across Products, Orders, Customers, Tags, Categories.

## Checklist
- [x] Ensure Products tab persists visibleCols, columnOrder, sort, pageSize, viewMode, statusFilter, excludeOutOfStock, categoryFilter, stockStatusFilter — both to localStorage (instant paint) and Supabase (cross-device). Remote always fetched on mount and merged in.
- [x] Same treatment for Orders tab: visibleCols, columnOrder, sort, pageSize, statusFilter, paymentFilter.
- [x] Same treatment for Customers page: visibleCols, columnOrder, sort, pageSize, roleFilter.
- [ ] Same treatment for Tags and Categories (Taxonomy) tabs if they have hideable columns.
- [x] Fix the bug where remote view preferences are skipped whenever any local preference exists — remote must still hydrate fields not in localStorage.
- [x] Verify `user_view_preferences` table is already deployed to prod (it is — base migration is old) and RLS is per-user scoped.

## Acceptance
- After toggling columns, reordering them, or changing page size / sort on any of Products, Orders, Customers and refreshing the page, the choice persists.
- Logging in from a different browser shows the same column layout (remote prefs win on cold load).
- No tab returns columns/sort/page size to the hardcoded defaults silently.
