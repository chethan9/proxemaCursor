---
title: Polish site switcher UX and test end-to-end
status: todo
priority: medium
type: feature
tags: [polish, ux]
created_by: agent
created_at: 2026-04-18T14:15:00Z
position: 35
---

## Notes
Final polish pass after the dual-sidebar architecture is working.

**Polish items:**
- Site switcher: keyboard nav (arrow keys in dropdown), close on ESC, search highlights matching text
- Active site in dropdown: checkmark + bold
- Empty state: if user has access to zero sites, show message + link to create site
- Site switcher shows site count at bottom of dropdown ("5 sites")
- Transition: when switching sites, brief loading indicator on sub-page while data refetches
- When switching sections within same site: no full reload, SiteSidebar state persists
- Breadcrumbs in main content: "Sites / TheMugStore / Orders" — use existing Breadcrumbs component

**Testing checklist (manual via `check_for_errors` + visual check):**
- All site sub-pages load without errors
- Main sidebar stays collapsed while in site context; restores user preference when leaving
- Menu editor changes to site menu reflect in SiteSidebar after save
- Permissions: user without sites_view doesn't see any of this
- Deep link to `/sites/[id]/orders` works (no redirect loop)

## Checklist
- [ ] Polish site switcher Popover: keyboard nav, ESC to close, search-match highlighting
- [ ] Add checkmark + bold styling for active site in switcher dropdown
- [ ] Handle zero-sites empty state in switcher
- [ ] Integrate existing Breadcrumbs component into SiteLayout showing "Sites > {siteName} > {sectionName}"
- [ ] Add loading indicator in SiteLayout while site data fetches
- [ ] Run `check_for_errors`, fix any TypeScript/lint issues
- [ ] Manual QA: navigate through all site sub-pages, switch sites, edit per-site menu, verify permissions gate correctly