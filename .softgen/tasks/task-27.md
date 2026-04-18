---
title: Menu editor page with drag-drop tree
status: done
priority: high
type: feature
tags: [menu-editor]
created_by: agent
created_at: 2026-04-18
position: 27
---

## Notes
Main editor UI. 2-level nesting, role tabs, per-node icon/color/label/hidden edits.

## Checklist
- [x] Role tabs (super_admin / admin / staff / readonly)
- [x] Drag-drop with @dnd-kit (top-level + within each group)
- [x] Per-row: drag handle, expand, icon picker, color picker, label input, hide toggle, delete
- [x] Unassigned banner when new pages detected
- [x] Save / Reset / Add Group actions
- [x] Super-admin auth guard