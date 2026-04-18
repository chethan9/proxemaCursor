---
title: Menu configs table, service, and merge logic
status: todo
priority: urgent
type: feature
tags: [menu-editor, backend]
created_by: agent
created_at: 2026-04-18T11:51:00Z
position: 24
---

## Notes
DB table stores per-role menu tree (2-level nesting max). Service handles CRUD. Merge logic reconciles stored config with current registry: enriches item nodes with href, appends unknown registry ids as "Unassigned", drops nodes whose registry id no longer exists.

MenuNode: `{ id, type: "item"|"group", label, icon, iconColor?, hidden, children? }`

RLS: super_admin write, all authenticated read (sidebar needs to load for everyone).

## Checklist
- [ ] Create menu_configs table (role text PK, config jsonb, updated_at, updated_by) + RLS (T1-style super_admin write, authenticated read) + seed 4 default rows (super_admin/admin/staff/readonly) mirroring current AppSidebar structure
- [ ] Create src/services/menuConfigService.ts with getConfig(role), saveConfig(role, tree), resetRole(role), copyFromRole(fromRole, toRole)
- [ ] Create src/lib/menu-merge.ts with mergeMenu(registry, config, userRole) that enforces 2-level max, adds unassigned, drops stale, filters superAdminOnly