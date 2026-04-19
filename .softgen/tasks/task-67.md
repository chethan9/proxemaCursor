---
title: Uniform site letter avatar + custom logo upload
status: done
priority: high
type: feature
tags: [ui, sites, branding]
created_by: agent
created_at: 2026-04-19
position: 67
---

## Notes
Dropped favicon logic in favor of uniform circular letter avatars (deterministic color per site) via shared SiteIcon. Added `stores.logo_url` + public `site-logos` storage bucket. Configuration page now has a Site Logo card with upload/remove.

## Checklist
- [x] Add `logo_url` column + `site-logos` storage bucket with policies
- [x] Rewrite SiteIcon as circular letter avatar honoring `logo_url`
- [x] AppSidebar + SiteSidebar use shared SiteIcon
- [x] Site Logo card in Configuration with upload/remove
- [x] Toasts + sidebar cache refresh on change