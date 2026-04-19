---
title: Cap sidebar site list to 5 with overflow into search
status: done
priority: high
type: feature
tags: [ui, sidebar, scaling]
created_by: agent
created_at: 2026-04-19
position: 68
---

## Notes
App sidebar caps sites to 5 (newest first, active site always included). Overflow opens a search popover listing all sites.

## Checklist
- [x] Sort by created_at DESC and cap to 5 with active site guaranteed
- [x] "+N more" row opens sites search popover
- [x] Collapsed state shows +N badge on overflow button
- [x] Popover shows all sites, searchable, with active indicator
- [x] Empty/edge cases handled (0, 1–5, 6+)