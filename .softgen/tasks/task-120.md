---
title: Clear app cache on logout (sidebar sites, menu, queries)
status: done
priority: high
type: bug
tags: [auth, cache]
created_by: agent
created_at: 2026-04-21T17:10:00Z
position: 120
---

## Notes
When user A signs out and user B signs in on the same browser, the sidebar still shows user A's sites / menu until the page is manually refreshed. Cache from the previous session is leaking into the new session.

Sources of cached data that need purging on logout:
- React Query cache (`src/lib/query-client.ts`, `src/lib/query-persistence.ts`) — stores, clients, sync runs, products, orders, etc. all cached here.
- `localStorage` keys used by the sidebar in `src/components/layout/AppSidebar.tsx`:
  - `sidebar-sites-cache`
  - `sidebar-menu-cache:super_admin`, `sidebar-menu-cache:admin`, `sidebar-menu-cache:user`
  - `sidebar-active-panel`, `sidebar-group-expanded:*`
- Module-level caches inside `AppSidebar.tsx`: `cachedSites`, `cachedMenuByRole`.
- `authCleanupCallbacks` already exists in `AuthProvider` — use/extend this registry so any feature module can register a cleanup fn.

`signOut` in `src/contexts/AuthProvider.tsx` already clears `sb-*` and `supabase` localStorage keys but does NOT clear the query cache or the sidebar-specific keys.

Requirements:
- On logout, clear the entire React Query cache (both in-memory and any persisted cache).
- Wipe all `sidebar-*` localStorage keys and the in-module cache variables.
- After login (any new session), sidebar must start with no stale sites/menu from a previous user.
- Implementation must not break the "remember me" flow; only session/user-scoped data is cleared.

## Checklist
- [ ] On sign-out, clear the entire React Query cache and any persisted query storage so no previous-user data survives.
- [ ] On sign-out, remove all sidebar localStorage keys (`sidebar-sites-cache`, `sidebar-menu-cache:*`, `sidebar-active-panel`, `sidebar-group-expanded:*`) and reset in-module caches in `AppSidebar.tsx`.
- [ ] Register the sidebar's cache-clear logic via the existing `authCleanupCallbacks` registry so it runs automatically during `signOut`.
- [ ] Verify a fresh login right after logout on the same tab shows only the new user's sites and menu without requiring a manual refresh.

## Acceptance
- Log in as user A (who has sites X, Y) → log out → log in as user B (who has site Z) → sidebar shows only Z, no flash of X/Y.
- No manual browser refresh needed between logout and login.
