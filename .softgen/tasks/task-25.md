---
title: Refactor AppSidebar to consume merged menu tree
status: done
priority: high
type: feature
tags: [menu-editor, sidebar]
created_by: agent
created_at: 2026-04-18
position: 25
---

## Checklist
- [x] Load menu_config for current user's role via menuConfigService
- [x] Merge with registry using mergeMenu, resolve with resolveForSidebar
- [x] Render groups + items + 2-level nesting from resolved tree
- [x] Preserve Sites group special case (inject stores as children of group-stores)
- [x] Respect icon, iconColor, label, hidden from config
- [x] Permission + superAdminOnly filtering in resolveForSidebar