---
title: Refactor AppSidebar to consume merged menu tree
status: todo
priority: high
type: chore
tags: [menu-editor, sidebar]
created_by: agent
created_at: 2026-04-18T11:51:00Z
position: 25
---

## Notes
Replace hardcoded groups in AppSidebar.tsx with a recursive renderer over the merged tree. Support 2 levels (group → item, or parent item → children). Parent items with children render as collapsible. Respect icon name (resolved via registry util) and iconColor.

## Checklist
- [ ] Fetch merged menu on mount using current user role; cache in context or SWR
- [ ] Render tree: top-level groups/items, nested children under collapsible parent
- [ ] Apply iconColor as inline style on icon
- [ ] Preserve current active-link highlighting + click-to-collapse-on-mobile behavior
- [ ] Add loading skeleton while menu config loads