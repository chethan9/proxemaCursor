---
title: Auth flow hardening — logout, guards, redirects
status: done
priority: urgent
type: bug
tags: [auth, security]
created_by: agent
created_at: 2026-04-21T01:30:00Z
position: 101
---

## Notes

Audit of login/logout/auth-guard flow surfaced 4 issues beyond the already-fixed `signOut` race condition in `src/contexts/AuthProvider.tsx`:

1. **`src/components/AuthGuard.tsx` uses raw `supabase.auth.signOut()`** in 2 places (inactive-profile branches). Same bug just fixed in AuthProvider — doesn't clear storage, doesn't hard-redirect, so the user appears signed-in on next navigation. Must call the `signOut` from `useAuth()` instead.

2. **`passedGuards` Set at module scope in AuthGuard.tsx never clears.** If user A logs out and user B logs in in the same tab, stale permission keys remain → user B briefly passes guards they shouldn't. Fix: expose a cleanup registry from AuthProvider (e.g. `authCleanupCallbacks: Set<() => void>`) that `signOut` invokes; AuthGuard registers a callback that does `passedGuards.clear()`.

3. **`src/pages/auth/signup.tsx` and `src/pages/auth/forgot-password.tsx` don't redirect already-authenticated users.** Only `login.tsx` does. An already-signed-in user hitting `/auth/signup` sees the form. Add the same `useEffect` redirect-to-`/` pattern `login.tsx` uses.

4. **`src/pages/auth/reset-password.tsx` doesn't validate the recovery session** before showing the form. If a user opens it directly (no recovery token), they see the form but `updateUser` will fail cryptically or update the wrong session. Check `supabase.auth.getSession()` on mount; if no recovery-type session, show an error state with link back to forgot-password.

Also verify: `src/pages/auth/bootstrap.tsx` and `src/pages/auth/confirm-email.tsx` behave correctly when visited while signed in (bootstrap is fine because it checks `can_bootstrap_super_admin`; confirm-email should probably redirect to `/` if already authed and no hash error).

## Checklist

- [x] AuthGuard inactive-user branches call `signOut` from `useAuth()` instead of raw `supabase.auth.signOut()`, so storage is fully cleared and a hard redirect runs.
- [x] Expose `authCleanupCallbacks` registry from AuthProvider; `signOut` invokes all callbacks before clearing Supabase session.
- [x] AuthGuard registers a cleanup callback that clears its `passedGuards` Set, so permission cache doesn't leak across user sessions.
- [x] Signup page redirects to `/` when an authenticated user loads it (mirror the login.tsx pattern).
- [x] Forgot-password page redirects to `/` when an authenticated user loads it.
- [x] Reset-password page checks for a valid recovery session on mount; if absent, shows "Invalid or expired link" state with a link back to `/auth/forgot-password` instead of the password form.
- [x] Confirm-email page redirects authenticated users to `/` when there is no error hash (don't show "Confirming..." spinner forever for an already-verified user).
- [x] After all changes, manually verify: logout fully clears session across reload; logging in as user B after user A does not briefly show user A's permissions; visiting `/auth/signup` while logged in bounces to `/`.

## Acceptance

- Logging out from any page lands on `/auth/login` and a page reload keeps you logged out.
- Logging in as a different user after logout does not momentarily flash the previous user's permitted screens.
- `/auth/signup`, `/auth/forgot-password`, and `/auth/reset-password` (without a recovery token) never render their forms to an authenticated user.