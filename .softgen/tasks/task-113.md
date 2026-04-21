---
title: Two-level sidebar with site-specific inner panel
status: todo
priority: high
type: feature
tags: [sidebar, navigation, ux]
created_by: agent
created_at: 2026-04-21T07:35:00Z
position: 113
---

## Notes
Redesign sidebar into a two-panel layout (see reference screenshot in uploads/image_c8cc7be7-bdc0-4923-9024-f35fa78c5342.png):

**Outer panel (global, always visible):**
- Brand/logo at top
- Projects (stores list — top 5 + "more" popover, unchanged)
- Groups render as collapsible rows: Overview, Management, Developer (with chevron, expand in place to show child items indented)
- User avatar + dropdown at bottom

**Inner panel (contextual, only when a site route is active — `/sites/[id]/*` or `/explore/[id]`):**
- Opens as a second sidebar column to the right of the outer sidebar
- Shows site switcher pill at top (avatar + site name + chevron → dropdown to switch site)
- Site menu grouped by Main / Manage (from `SITE_MENU_REGISTRY` in `src/lib/menu-registry.ts`)
- Active item highlighted
- When not on a site route, inner panel is hidden (outer panel alone)

Key behaviors:
- Outer panel group rows (Overview/Management/Developer) are collapsible; current "Developer" submenu pattern extends to all groups (task-110 already does this — keep)
- Both panels respect the existing menu-config per role (labels, icons, hidden items, order) from menu editor
- Inner panel uses the existing `SiteSidebar.tsx` pattern but renders alongside the outer sidebar instead of replacing it — so users always see global nav + site nav simultaneously
- Existing `SiteLayout.tsx` currently swaps in `SiteSidebar`. Refactor: `AppLayout` wraps both panels; when on a site route, inner panel is shown; otherwise only outer.

Files to touch:
- `src/components/layout/AppSidebar.tsx` (outer, already collapsible-group-capable from task-110)
- `src/components/layout/SiteSidebar.tsx` (becomes inner panel, no longer full-height replacement)
- `src/components/layout/AppLayout.tsx` / `SiteLayout.tsx` (compose both panels; site route detection)
- Page wrappers in `src/pages/sites/[id]/*.tsx` (use new combined layout)

## Checklist
- [ ] Outer sidebar renders on every route with brand, Projects + sites list, collapsible groups (Overview, Management, Developer), user menu
- [ ] Inner sidebar renders only on `/sites/[id]/*` and `/explore/[id]` routes, positioned to the right of the outer sidebar
- [ ] Inner sidebar shows current site avatar+name with dropdown to switch between sites
- [ ] Inner sidebar lists site menu items grouped by Main / Manage with active-item highlighting
- [ ] Clicking a group chevron in the outer sidebar expands/collapses child items inline (not as popover when expanded)
- [ ] Collapsing the outer sidebar keeps the inner sidebar functional and visible
- [ ] Both sidebars respect menu-config overrides (labels, icons, hidden, order) from menu editor

## Acceptance
- On `/sites/abc/products`: two sidebars visible side-by-side — outer (global) + inner (site menu with Products active).
- On `/` (dashboard): only outer sidebar visible.
- Group labels in outer sidebar (Overview, Management, Developer) expand/collapse with a chevron.