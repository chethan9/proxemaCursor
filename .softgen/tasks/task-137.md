---
title: Default site navigation to home page
status: todo
priority: high
type: bug
tags: [navigation, sidebar, ux]
created_by: agent
created_at: 2026-04-22T02:00:00Z
position: 137
---

## Notes

When a user clicks a site from the left sidebar (AppSidebar.tsx), the destination is currently `/sites/${id}/products`. Going forward, every site click — whether from the sidebar icons, the collapsed popover search, or the "+N more sites" overflow popover — must land on `/sites/${id}/home` instead.

**File to edit:** `src/components/layout/AppSidebar.tsx`

**Two occurrences of `/products` exist in that file (confirmed via search):**
1. Inside the sites popover `onSelect` handler — the "go to site" action for collapsed-sidebar search results.
2. The `href` built for each visible site item in the expanded sidebar sites list.

Both should be changed from `/sites/${site.id}/products` to `/sites/${site.id}/home`.

**Other site-entry points are already correct** — no action needed on:
- `src/pages/sites/[id]/index.tsx` (redirects to `/home`)
- `src/components/project/SitesTable.tsx` (navigates to `/home`)
- `src/components/project/CompactSiteRow.tsx` (navigates to `/home`)
- `src/components/project/GridSiteCard.tsx` (navigates to `/home`)

## Checklist

- [ ] Change both `/sites/${site.id}/products` references in `AppSidebar.tsx` to `/sites/${site.id}/home`
- [ ] Verify sidebar site icons (collapsed state) navigate to home page
- [ ] Verify sidebar site rows (expanded state) navigate to home page
- [ ] Verify "+N more sites" popover also navigates to home

## Acceptance

- Clicking any site from the left sidebar lands on the site Home dashboard, not the Products table.
- No remaining references to `/sites/${id}/products` exist in `AppSidebar.tsx`.