---
title: Default landing always Projects + fallback guard
status: done
priority: urgent
type: bug
tags: [auth, routing]
created_by: agent
created_at: 2026-04-21T17:10:00Z
position: 117
---

## Notes
Currently after login users land on `/` (Health/Dashboard). Requirement: every login MUST land on `/projects` unless the user has explicitly set a different `default_landing_path` in their profile settings. If that stored landing path is no longer valid (e.g. points to a site that was removed, or any path that 404s / is inaccessible), fall back to `/projects`.

Related files:
- `src/pages/auth/login.tsx` — currently reads `profile.default_landing_path` and pushes there; it falls through to `/` when not set.
- `src/contexts/AuthProvider.tsx` — holds profile with `default_landing_path`.
- `src/pages/index.tsx` — the Health/Dashboard page users currently land on.

Key rules:
- If `default_landing_path` is null/empty → redirect to `/projects`.
- If it points to `/sites/:id/...` → validate the site still exists and user has access before redirecting; otherwise redirect to `/projects` AND clear/reset the stored preference so it doesn't keep failing.
- If it's a generic path (e.g. `/clients`, `/api-management`) → just use it.
- The `?redirect=` query param (used when auth-guard bounces user to login) should still take priority over the default landing path.

## Checklist
- [ ] On successful login, resolve destination in this order: explicit `?redirect=` param → user's saved `default_landing_path` (if valid) → `/projects`.
- [ ] When the saved landing path references a site ID, verify the site is still accessible to the user before navigating; if missing, clear the stored value and route to `/projects`.
- [ ] Ensure the root path `/` also respects the same rule (if a logged-in user hits `/` and hasn't set a custom landing, send them to `/projects` instead of showing Health at `/`).
- [ ] Profile settings page continues to let users choose a landing path; saving an invalid one should not be possible, and removing the preference reverts to `/projects`.

## Acceptance
- Fresh login with no preference set → lands on `/projects`.
- User sets landing to a specific site, then that site is deleted → next login lands on `/projects` (no error page).
- User with `?redirect=/sites/xyz/products` login link still lands on that redirect target.
