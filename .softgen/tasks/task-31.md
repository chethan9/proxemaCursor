---
title: Create SiteLayout wrapper with auto-collapsing main sidebar
status: done
priority: urgent
type: feature
tags: [layout, routing]
created_by: agent
created_at: 2026-04-18T14:15:00Z
position: 31
---

## Notes
Layout component that composes `AppSidebar` (forced collapsed) + `SiteSidebar` + page content for all `/sites/[id]/*` routes.

**Behavior:**
- Force AppSidebar into collapsed mode while inside a site (but don't persist the user's global preference — restore when they leave)
- Render SiteSidebar right after AppSidebar, before main content
- Page content area: same padding/layout as `AppLayout`

**Implementation note:** `AppSidebar` currently reads `collapsed` from local state + localStorage. To force collapse without breaking global preference:
- Add optional `forceCollapsed?: boolean` prop to AppSidebar — when true, render collapsed UI without touching the user's saved preference
- Hide the collapse/expand toggle button when forceCollapsed is true

## Checklist
- [ ] Add `forceCollapsed?: boolean` prop to `AppSidebar.tsx`: when true, use collapsed UI regardless of state, hide the toggle button, skip localStorage writes
- [ ] Create `src/components/layout/SiteLayout.tsx`: reads `siteId` from router.query.id, renders `<AppSidebar forceCollapsed />` + `<SiteSidebar siteId={id} />` + `<main>{children}</main>`; handles loading state when id is not yet available
- [ ] Export SiteLayout; wrap site pages (next task) with it