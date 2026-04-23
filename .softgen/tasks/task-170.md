---
title: Fix Health nav redirect + sidebar menu flash
status: done
priority: urgent
type: bug
tags: [nav, sidebar, ux]
created_by: agent
created_at: 2026-04-23T15:00:00Z
position: 170
---

## Notes
Two navigation bugs:
1. Clicking Health (href=`/`) redirected to `/projects` every time because the auto-landing redirect in `src/pages/index.tsx` fired on every visit.
2. Sidebar briefly showed all menu items on login before filtering — useState initializer loaded stale localStorage cache before user-id verification.

## Checklist
- [x] Remove auto-redirect from `src/pages/index.tsx` — `/` now always renders the dashboard.
- [x] Add `menuReady` state in `AppSidebar.tsx` — starts false, flips true only after useEffect confirms `user.id` matches stored value and menu is loaded.
- [x] Clear cached menu/sites when user ID changes (login as different user).
- [x] Highlight Settings on any `/settings/*` route.

## Acceptance
- Clicking Health loads `/` and stays there.
- On fresh login, sidebar shows skeleton until the correct filtered menu is ready.
- Settings item highlights on all settings sub-pages.