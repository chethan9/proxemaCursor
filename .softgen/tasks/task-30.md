---
title: Create SiteSidebar component with site switcher
status: todo
priority: urgent
type: feature
tags: [sidebar, layout, navigation]
created_by: agent
created_at: 2026-04-18T14:15:00Z
position: 30
---

## Notes
Build the secondary sidebar that appears when inside a site context (`/sites/[id]/*`). Matches the Quantro/Shopify pattern from user reference image.

**Visual spec:**
- Width 200px, white background (uses `--card`/`--background` tokens, NOT sidebar dark tokens — this is a light panel sitting next to the collapsed dark main sidebar)
- Top: site switcher dropdown — compact button showing site favicon + name + chevron, opens dropdown listing all sites with search
- Nav list: top-level items (Home, Orders, Products, Customers, Categories, Tags, Coupons) with icons
- "SYSTEM" label (uppercase tracking-wider muted text) + grouped items (Sync, Webhooks, Logs, History, Archive)
- "MANAGE" label + Settings
- Active item: subtle bg highlight + left accent bar (matches existing sidebar active pattern but in light theme)

**Data:**
- Consume `getSiteMenuConfig(role, siteId)` from task-29
- Reuse `resolveForSidebar()` + `resolveIcon()` from existing `menu-merge.ts` / `menu-registry.ts`
- Site list from `getStores()` (cache like AppSidebar does)

**Behavior:**
- Clicking a site in dropdown → `router.push('/sites/[newId]' + currentSubPath)` (preserves which sub-page they're on)
- Active detection: match `router.pathname` against node.href (supports nested routes)

## Checklist
- [ ] Create `src/components/layout/SiteSidebar.tsx`: accepts `siteId` prop, renders site switcher + nav tree
- [ ] Build site switcher: Popover with search input + scrollable site list, shows favicon via existing `SiteIcon` pattern, shows status dot
- [ ] On site switch: extract sub-path from `router.asPath` (e.g. "/orders") and push to new site preserving it; fallback to "/" if no sub-path
- [ ] Render menu items with Link, active state styling (bg-accent + left accent bar), icons via resolveIcon, support both flat items and grouped items with labels
- [ ] Handle loading state (show skeleton while menu + sites load)
- [ ] Add caching pattern similar to AppSidebar (cachedSiteMenuByKey map)