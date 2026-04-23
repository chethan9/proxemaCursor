---
title: Fix Health nav redirect + sidebar menu flash
status: in_progress
priority: urgent
type: bug
tags: [nav, sidebar, ux]
created_by: agent
created_at: 2026-04-23T15:00:00Z
position: 170
---

## Notes
Two navigation bugs:
1. Clicking Health (href=`/`) redirects to `/projects` every time because the auto-landing redirect in `src/pages/index.tsx` fires on every visit, not only on initial post-login landing.
2. Sidebar briefly shows all menu items on login before filtering to role-appropriate items. Root cause: `useState` initializer in `AppSidebar` computes `buildInitialTree(can, isSuperAdmin)` before permissions finalize, then useEffect re-renders with correct tree.

## Checklist
- [ ] Remove auto-redirect from `src/pages/index.tsx` — let `/` always render the dashboard. Landing preference can be handled at login success instead (future task).
- [ ] Add `menuReady` state in `AppSidebar.tsx` — only flip true after saved config loaded from Supabase (or confirmed none exists). Show skeleton while `!menuReady`.
- [ ] Verify on fresh login: no flash of all items, Health click stays on `/`.

## Acceptance
- Clicking Health in sidebar loads `/` and stays there (doesn't bounce to `/projects`).
- On fresh login, sidebar shows skeleton until the correct filtered menu is ready — no flash of unauthorized items.