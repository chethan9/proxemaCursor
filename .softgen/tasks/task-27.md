---
title: Menu editor page with drag-drop tree
status: todo
priority: high
type: feature
tags: [menu-editor, ui]
created_by: agent
created_at: 2026-04-18T11:51:00Z
position: 27
---

## Notes
Super-admin-only page at /settings/menu-editor. Role tabs switch configs. Drag-drop with @dnd-kit supporting 2-level nesting (drop-as-child vs drop-as-sibling zones). Per-node inline editing: label, icon, color, hidden toggle. Banner shows unassigned count. Actions: Save, Reset, Add Group, Copy from role.

Install: @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

## Checklist
- [ ] Install @dnd-kit packages
- [ ] Create src/components/menu-editor/MenuNodeRow.tsx: drag handle, icon picker trigger, color picker trigger, label input, eye toggle, delete (custom groups), indent/outdent buttons
- [ ] Create src/components/menu-editor/MenuTree.tsx: dnd-kit SortableContext with 2-level support (parent/child drop zones); onChange(newTree)
- [ ] Create src/pages/settings/menu-editor.tsx: role tabs, unassigned banner, MenuTree, top-bar actions (Save/Reset/Add Group/Copy from role dropdown)
- [ ] Wire menuConfigService + AuthGuard requiring super_admin role