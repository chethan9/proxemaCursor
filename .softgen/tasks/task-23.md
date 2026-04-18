---
title: Create menu registry from current sidebar routes
status: done
priority: urgent
type: chore
tags: [menu-editor, foundation]
created_by: agent
created_at: 2026-04-18
position: 23
---

## Notes
Single source of truth for all registered routes. Every new page = 1 entry here.

## Checklist
- [x] Create src/lib/menu-registry.ts exporting MENU_REGISTRY array
- [x] Each entry: id, defaultLabel, defaultIcon, href, defaultGroup, defaultOrder, permission, superAdminOnly
- [x] Extract all routes from current AppSidebar.tsx
- [x] Export ICON_MAP and resolveIcon(name) utility