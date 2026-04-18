---
title: Add per-site menu config support to menu editor
status: done
priority: high
type: feature
tags: [menu, settings, multi-tenant]
created_by: agent
created_at: 2026-04-18T14:15:00Z
position: 29
---

## Notes
Extend the existing menu editor to support per-site menu customization for the new site-scoped sidebar. Keep backwards compatibility with the global menu editor.

**Current state:**
- `src/services/menuConfigService.ts` reads/writes menu config by `RoleKey` (super_admin/admin/staff/readonly)
- `src/lib/menu-registry.ts` registers menu items; `src/lib/menu-merge.ts` merges config + registry
- `src/pages/settings/menu-editor.tsx` UI edits global menu per role

**Goal:** Add a second menu scope — "site" — that controls the new secondary sidebar (Home/Orders/Products/Customers/Categories/Tags/Coupons + System group + Settings). Defaults come from a hard-coded registry; admins can override per-site OR globally.

**Data model:**
- New column on `menu_configs` table: `scope` (text, default "global") — values: "global" | "site"
- New nullable column: `site_id` (uuid, references stores.id) — when null + scope="site", it's the default site menu
- Unique constraint: (scope, role, site_id)

**Resolution order for a site's sidebar:**
1. Site-specific override (scope="site", site_id=X, role=Y)
2. Global site default (scope="site", site_id=NULL, role=Y)
3. Hard-coded registry defaults

## Checklist
- [ ] Add migration: alter `menu_configs` add `scope text default 'global'`, `site_id uuid references stores(id) on delete cascade`, drop old unique constraint, add new unique (scope, role, site_id)
- [ ] Register site-menu items in `src/lib/menu-registry.ts` under a new `siteMenuRegistry` export (Home, Orders, Products, Customers, Categories, Tags, Coupons, Sync, Webhooks, Logs, History, Archive, Settings) with groups: top-level items + "System" group + "Manage" group (Settings)
- [ ] Update `menuConfigService.ts`: add `getSiteMenuConfig(role, siteId?)` that resolves per-site → global-site → defaults
- [ ] Extend `menu-editor.tsx`: add a "Scope" toggle (Global / Site menu) at top; when Site menu selected, show site picker dropdown ("All sites (default)" + list of sites); load/save against site-scoped config