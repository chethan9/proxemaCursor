---
title: Menu configs table, service, and merge logic
status: done
priority: urgent
type: feature
tags: [menu-editor, database]
created_by: agent
created_at: 2026-04-18
position: 24
---

## Notes
Database + merge logic. Table stores per-role JSON tree; merge fn reconciles with registry.

## Checklist
- [x] Create menu_configs table (role PK, config jsonb, updated_at, updated_by)
- [x] RLS: super_admin read/write, other authenticated read-only
- [x] src/services/menuConfigService.ts: getMenuConfig, saveMenuConfig, resetMenuConfig
- [x] src/lib/menu-merge.ts: mergeMenu + resolveForSidebar + buildDefaultTree
- [x] 2-level nesting enforced in resolveForSidebar