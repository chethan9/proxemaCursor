---
title: Fix AuthGuard race — super_admin locked out with ?error=forbidden
status: todo
priority: urgent
type: bug
tags: [auth, critical, production]
created_by: agent
created_at: 2026-04-23T17:30:00Z
position: 172
---

## Notes

**Symptom:** On PRODUCTION only (not dev), super_admin (`it@vizsoft.in`) is redirected to `/?error=forbidden` when hitting any page wrapped in `AuthGuard` with `requireSuperAdmin` or `requirePermission` (menu-editor, explore, site customers, site orders). Sidebar also shows a minimal user-level menu. DB is correct — `profile.role = 'super_admin'`, `permissions = ['*']`.

**Why prod-only:** classic timing race. In dev, Supabase calls complete in ~10-50ms and profile loads before AuthGuard's effect evaluates gates. In prod, calls take ~300-800ms and AuthGuard's effect runs while `profile` is still `null`.

**Root cause:** `AuthProvider` flips `loading=false` as soon as the initial session is known, but `profile`/`role`/`permissions` continue loading asynchronously. During that window:
- `loading = false`
- `profile = null` → `isSuperAdmin = profile?.role === "super_admin"` evaluates to `false`
- `permissions = []` → `can() = false`

`AuthGuard`'s effect fires immediately, sees `requireSuperAdmin && !isSuperAdmin` → `router.replace("/?error=forbidden")`. User is redirected before profile ever finishes loading.

The sidebar fix (`a84ffb5`) addressed `AppSidebar.tsx`. `AuthGuard.tsx` has the same race and needs the same gate pattern.

**Do NOT wipe the database.** The DB is fine. A wipe would destroy real customer data (clients, sites, sync history, billing, audit log) and NOT fix this bug — it would still happen to any newly-bootstrapped super_admin.

**Immediate workaround for user while fix ships:** in browser DevTools console on prod, run `localStorage.clear(); location.reload()` — clears any poisoned sidebar cache from the earlier bug. Does NOT fix the redirect (that requires the code fix), but restores the correct sidebar once the code fix lands.

## Checklist
- [ ] `src/components/AuthGuard.tsx`: add gate so the effect does NOT redirect until auth state is truly stable — treat "profile still loading" as pending, not as forbidden
- [ ] Stability gate: `authLoading === false` AND `profile !== null` (profile query has returned). For `requireSuperAdmin` or `requirePermission` checks: additionally wait until role is loaded (role !== null) OR profile.role === "super_admin" (super admin doesn't need role row)
- [ ] While gate is not satisfied, show the same loader `AuthGuard` already renders during `checking` — do not redirect
- [ ] 3-second safety timeout: if profile still hasn't loaded after 3s, fall back to current redirect logic so users aren't stuck on a spinner
- [ ] `src/contexts/AuthProvider.tsx`: expose a `profileLoaded` boolean (separate from `loading`) so AuthGuard can distinguish "no profile query run yet" from "query completed, no profile found"
- [ ] Bump localStorage cache keys one more time to invalidate any remaining poisoned sidebar caches on affected users' browsers (change `MENU_CACHE_VERSION` from `v2` to `v3`)
- [ ] Smoke test on prod deploy: log in as super_admin → hit `/settings/menu-editor` directly by URL on a fresh tab → should land on the page, not `/?error=forbidden`
- [ ] Smoke test on prod: log in as regular user (`chethan@vizsoft.in`) with `sites.view` permission → hit `/sites/[siteId]/customers` → should load without flicker-redirect
- [ ] Smoke test on prod: regular user sidebar shows Sites, Sync Runs, Webhooks, API, Payment Methods (all items they have permission for), not just Health/Billing/Settings

## Acceptance
- In production, super_admin can hit any super-admin-only page by URL on a fresh tab and lands on the page
- In production, regular users with the right permission can hit permission-gated pages without flicker-redirect
- No user ever sees `/?error=forbidden` on pages they actually have access to
- Loader shows briefly (<3s) during the profile-loading window instead of redirecting
- Sidebar in prod matches sidebar in dev for the same user