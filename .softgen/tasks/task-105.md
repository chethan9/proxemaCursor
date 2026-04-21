---
title: Fix sidebar menu flicker on first visit / first click
status: todo
priority: high
type: bug
tags: [ui, sidebar, performance]
created_by: agent
created_at: 2026-04-21T03:30:00Z
position: 105
---

## Notes

Both `AppSidebar` and `SiteSidebar` flicker on the first visit of a session (and on first click into a fresh site) — menu items pop in, reorder, or swap between admin and super-admin views before settling. User wants stable, final-layout-first rendering.

### Root causes (verified in current code)

**`src/components/layout/AppSidebar.tsx`:**
1. **Wrong-role cache leak** (`loadCachedMenu` lines ~100-106): initial `menuTree` state tries cached role keys in order `["super_admin", "admin", "user"]` — a super_admin user can briefly see the admin-role cached menu from a previous session before their real role's config arrives.
2. **No synchronous default fallback**: when no cached menu exists for the current role, `menuTree` starts as `[]` → skeleton renders → then after `getMenuConfig` network call resolves, items animate in. Causes ~300-800ms empty/skeleton → full-menu flash.
3. **Permission array re-renders**: `permissions.join(",")` in effect deps works but `can()` closure identity changes each `AuthProvider` re-render, so `resolveForSidebar` can produce slightly different trees mid-session (e.g., `Settings`, `API`, `Activity` nodes flashing in/out while auth hydrates).
4. **`authLoading` gate is too loose**: items render based on `profile?.role` before `permissions` array is populated — permission-gated items (API, Users, Roles) pop in once permissions resolve a tick later.

**`src/components/layout/SiteSidebar.tsx`:**
1. **No default fallback tree**: on first visit to any site with a fresh session, `cachedSiteMenuByKey` is empty → shows 6 skeleton rows → items appear after async fetch.
2. **`getStores()` refetches on every mount** — cached `sites` render, then re-render once network list arrives (usually identical), causing the site-switcher label and icon to blink.

### Fix strategy

**Render the correct shape synchronously on first paint:**
- If role-specific cache exists for THIS role → use it (unchanged behavior).
- Else → synchronously compute the default tree via `buildDefaultTree()` + `resolveForSidebar()` using current `can`/`isSuperAdmin`. No skeleton, no empty state.
- After `getMenuConfig` resolves, only update state if the resolved tree differs (shallow-compare serialized form) — silent replacement, no layout shift.

**Stop showing the wrong role's cached menu:**
- Gate `loadCachedMenu` on EXACT role match only. No fallback across roles.
- Wait for `profile?.role` to be known before first paint (very short — AuthProvider hydrates from localStorage session instantly).

**Stable permission filtering:**
- Hold off on permission-gated filtering until `permissions.length > 0` OR `authLoading === false`.
- Guard against `can()` closure churn: memoize the resolved tree by `[permissions.join(","), isSuperAdmin, menuConfigJson]`.

**Site sidebar fallback:**
- When no cache, compute `buildDefaultSiteTree()` → `resolveForSiteSidebar(…, siteId, can)` synchronously as initial state.
- Replace silently after fetch.

**Stores list:**
- Keep localStorage cache first, but skip the re-render if the network list is equivalent (compare by `id + updated_at` hash).

### Constraints
- Must not regress the "admin-configured menu overrides defaults" behavior — server config still wins when it arrives.
- No additional network calls; just smarter synchronous initialization.
- Don't change the menu-merge or registry public API.

## Checklist

- [ ] Add `buildInitialTree(role, can, isSuperAdmin)` helper in `src/lib/menu-merge.ts` that returns the resolved default tree synchronously (merges default config, resolves for sidebar, filters by permissions)
- [ ] `AppSidebar`: change initial `menuTree` state to `loadCachedMenu(currentRoleKey)` (exact role only, no cross-role fallback) → fall back to `buildInitialTree(roleKey, can, isSuperAdmin)` when cache is empty
- [ ] `AppSidebar`: remove the skeleton loader branch — with synchronous initial tree there's nothing to skeleton. Keep network fetch in effect, but only `setMenuTree` when serialized tree differs from current
- [ ] `AppSidebar`: gate effect on `permissions.length > 0 || !authLoading` so permission-gated items don't pop in late
- [ ] `SiteSidebar`: add synchronous default fallback via `buildInitialSiteTree(siteId, can)` when `cachedSiteMenuByKey` miss — remove skeleton-only state
- [ ] `SiteSidebar`: compare network `getStores()` result to cached list by `id+updated_at`; skip `setSites` when unchanged to prevent site-switcher blink
- [ ] Verify: open app in incognito → first paint of `/` shows final sidebar layout (no skeleton, no item pop-in). Navigate to `/sites/:id/products` first time → final site sidebar layout on first paint
- [ ] Verify: log out, log back in as super_admin after being admin → super_admin menu appears on first paint (no admin menu flash)

## Acceptance

- First-ever page load of a session renders sidebar items in final order/visibility with no visible skeleton or item pop-in.
- First click into a site renders the site sidebar in final form immediately.
- Switching between roles (log out / log back in) never shows the previous role's menu cache.
- Settings, API, Activity items don't flash in/out during auth hydration.