---
title: Fix navigation flicker on permission-gated pages
status: done
priority: high
type: bug
tags: [auth, ux, performance]
created_by: agent
created_at: 2026-04-20
position: 92
---

## Notes

**Problem:** Clicking menu items (Activity, Settings, Sync Runs, Webhooks, API, admin panel) causes a ~500ms full-screen spinner flicker where the sidebar unmounts and remounts. Sites/Projects/Home don't flicker.

**Root cause — two issues combined:**

1. `AuthGuard` (`src/components/AuthGuard.tsx`) uses a local `useRef` `passedOnceRef` to skip the loader after first pass. But since `AuthGuard` is rendered *inside each page* via `AppLayout`, the ref resets on every navigation — so every page-change re-shows the full-screen `<Loader2 />`.

2. `AuthProvider` (`src/contexts/AuthProvider.tsx`) sets `loading=true` on every Supabase `SIGNED_IN` event (fires on tab focus / token refresh / session hydration). While `loading` is true, `AuthGuard.fastPassed` evaluates false → loader shows.

**Fix strategy (minimal surface — do NOT touch per-page layouts):**

- **AuthGuard:** Replace per-component `passedOnceRef` with a module-level `Set<string>` keyed by `permission + superAdmin` combo. Once a given permission check has passed in this session, never show the full-screen loader again for that combo — children render immediately while permission re-verifies silently in the background. Redirect only if re-check actually fails.
- **AuthProvider:** Track `initialized` flag. Only toggle `loading` before first session resolves. On subsequent `SIGNED_IN` events (tab-focus, token refresh), update `user` silently and re-fetch profile in the background without flipping `loading`. `SIGNED_OUT` still flips `loading=false` instantly.
- **AuthLayout / AppSidebar:** No changes needed — they already handle skeleton states fine.

**Pages affected (all use `AppLayout requirePermission={...}`):**
- `/sync-runs`, `/webhooks`, `/webhooks/activity`, `/api-management`
- `/settings/*` (theme, users, roles, profile, payment-methods, menu-editor)
- `/clients`, `/clients/[id]`
- `/explore`, `/explore/[id]`
- `/admin/notifications` (uses `requireSuperAdmin`)

Fix is at the `AuthGuard` + `AuthProvider` layer, so all these pages benefit with no page-level changes.

**Out of scope:**
- Hoisting layouts into `_app.tsx` (Next.js getLayout pattern) — deferred.
- Any page-level code changes.
- Changing how permissions are defined or checked.

**Validation:** Click Activity → Settings → API → Sync Runs rapidly. Sidebar must stay mounted, no full-screen loader should appear, only inner content changes. Same check on `/admin/notifications`.

## Checklist

- [ ] Replace `passedOnceRef` in `AuthGuard` with a module-level session cache keyed by permission + superAdmin flag
- [ ] On subsequent navigation to a previously-passed guard, render children immediately and run permission re-check silently (no loader)
- [ ] Still perform async redirect checks (inactive profile, revoked permission) but without blocking render
- [ ] In `AuthProvider`, add `initialized` flag; only toggle `loading=true` during first session resolution
- [ ] On `SIGNED_IN` events after initialization, update user + refetch profile without flipping `loading`
- [ ] Keep `SIGNED_OUT` behavior unchanged (immediate clear)
- [ ] Verify no regression on fresh page load / hard refresh / logout / login / bootstrap flow

## Acceptance

- Navigating between Activity, Settings, Sync Runs, Webhooks, API, admin panel shows no full-screen spinner — sidebar stays mounted, only content area updates.
- Fresh page load / hard refresh still shows the initial auth loader once before first render (unchanged).
- Logging out still redirects to `/auth/login` cleanly.
- Tab focus / token refresh no longer causes the auth loader to appear on any page.