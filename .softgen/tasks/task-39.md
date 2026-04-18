---
title: Wire per-site workspace pages (Home, Orders, Products, Categories, Tags, Configuration)
status: todo
priority: high
type: feature
tags: [routing, site-workspace, sidebar]
created_by: agent
created_at: 2026-04-18
position: 39
---

## Notes

Per-site workspace (the "Todoo" entry in the sidebar, blue-circled in user's screenshot) is separate from `/projects/[id]` (Sync Engine page, task-38). This task wires up the real workspace under `/sites/[id]/*` with its own secondary sidebar.

**Route structure** (keep these paths):
- `/sites/[id]/home` — overview: health score, recent activity, quick stats scoped to this site
- `/sites/[id]/orders` — scoped orders table (render OrdersTab filtered by storeId)
- `/sites/[id]/products` — scoped products table (render ProductsTab filtered by storeId)
- `/sites/[id]/categories` — scoped categories table (render TaxonomyTab with type="categories")
- `/sites/[id]/tags` — scoped tags table (render TaxonomyTab with type="tags")
- `/sites/[id]/configuration` — rename/alias for current `settings.tsx` content, or keep both

**Secondary sidebar** (`src/components/layout/SiteSidebar.tsx` already exists at 250 lines — inspect first):
- Shows when user is on any `/sites/[id]/*` route
- Header: site switcher dropdown (current site selected, list of all user's sites to jump between)
- MAIN section: Home, Orders, Products, Categories, Tags
- MANAGE section: Configuration
- Auto-collapses main AppSidebar (use existing collapsed state)

**Main sidebar integration** (AppSidebar.tsx):
- Under "Projects" menu item, show list of user's sites as sub-items (Todoo, etc.) — clicking takes user to `/sites/[id]/home`
- When user is inside `/sites/[id]/*`, main sidebar auto-collapses and SiteSidebar takes over

**Scoping existing components:**
- `ProductsTab`, `OrdersTab`, `TaxonomyTab` already accept store filtering via props/context — verify they accept a `storeId` prop and filter queries accordingly
- If not, extend them to accept `storeId` without breaking the global `/explore` page that uses them unscoped
- Each per-site page wraps the Tab component in `SiteLayout` and passes `storeId` from `router.query.id`

**Files to create/modify:**
- OPEN FIRST: `src/components/layout/SiteSidebar.tsx` (250 lines — see current state), `src/components/layout/SiteLayout.tsx` (28 lines — stub), `src/pages/sites/[id]/home.tsx` (30 lines — stub), `src/pages/sites/[id]/products.tsx` (29 lines — stub), `src/pages/sites/[id]/_shared.tsx` (88 lines — shared logic)
- UPDATE `src/pages/sites/[id]/home.tsx`: render site overview (health score, last sync, record counts, quick links to sync engine at `/projects/[id]`)
- UPDATE `src/pages/sites/[id]/products.tsx`: render `<ProductsTab storeId={router.query.id} />` inside SiteLayout
- UPDATE `src/pages/sites/[id]/orders.tsx`: render `<OrdersTab storeId={router.query.id} />` inside SiteLayout
- UPDATE `src/pages/sites/[id]/categories.tsx`: render `<TaxonomyTab storeId={router.query.id} type="categories" />`
- UPDATE `src/pages/sites/[id]/tags.tsx`: render `<TaxonomyTab storeId={router.query.id} type="tags" />`
- RENAME OR ALIAS `src/pages/sites/[id]/settings.tsx` → `configuration.tsx` (or keep settings.tsx and add configuration.tsx that re-exports)
- UPDATE `src/components/layout/SiteLayout.tsx`: wrap children with AppSidebar (forced collapsed) + SiteSidebar + content area
- UPDATE `src/components/layout/SiteSidebar.tsx`: add site switcher dropdown at top, menu items as listed above, active state highlighting
- UPDATE `src/components/layout/AppSidebar.tsx`: auto-collapse when route matches `/sites/[id]/*`; optionally show nested site list under Projects

**Verify components accept storeId prop:**
- `src/components/explore/ProductsTab.tsx` — check for storeId prop/filter
- `src/components/explore/OrdersTab.tsx` — check for storeId prop/filter
- `src/components/explore/TaxonomyTab.tsx` — check for storeId prop/filter
- If missing, add optional `storeId?: string` prop that scopes queries; global explore passes undefined (all stores), per-site pages pass the route id

## Checklist

- [ ] Open SiteSidebar.tsx, SiteLayout.tsx, _shared.tsx, home.tsx, products.tsx to confirm current state
- [ ] Verify ProductsTab/OrdersTab/TaxonomyTab accept optional storeId prop — if not, add it and update their internal queries to filter by store_id when provided
- [ ] Build SiteLayout.tsx: render AppSidebar (collapsed) + SiteSidebar + page content
- [ ] Build SiteSidebar.tsx: site switcher dropdown header + MAIN section (Home/Orders/Products/Categories/Tags) + MANAGE section (Configuration) + active route highlighting
- [ ] Wire home.tsx: site overview page with health score, record counts, last sync, link to `/projects/[id]` for Sync Engine access
- [ ] Wire products.tsx: `<SiteLayout><ProductsTab storeId={id} /></SiteLayout>`
- [ ] Wire orders.tsx: `<SiteLayout><OrdersTab storeId={id} /></SiteLayout>`
- [ ] Wire categories.tsx: `<SiteLayout><TaxonomyTab storeId={id} type="categories" /></SiteLayout>`
- [ ] Wire tags.tsx: `<SiteLayout><TaxonomyTab storeId={id} type="tags" /></SiteLayout>`
- [ ] Rename settings.tsx UI label to "Configuration" or create configuration.tsx alias; update SiteSidebar link
- [ ] Update AppSidebar: show list of sites nested under "Projects" (or as separate entries), click takes user to `/sites/[id]/home`; auto-collapse when on `/sites/[id]/*`
- [ ] Test: click Projects → fleet list → click card → `/projects/[id]` Sync Engine loads (task-38)
- [ ] Test: click site entry in main sidebar → `/sites/[id]/home` → secondary sidebar shows → click Products → scoped table loads
- [ ] Test: site switcher dropdown in secondary sidebar lets user jump between sites
- [ ] Run check_for_errors
