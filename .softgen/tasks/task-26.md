---
title: Icon picker and color picker components
status: todo
priority: high
type: feature
tags: [menu-editor, ui]
created_by: agent
created_at: 2026-04-18T11:51:00Z
position: 26
---

## Notes
Reusable pickers for the menu editor. Icon picker shows a curated grid of ~100 lucide icons (not all 1400) with search. Color picker shows 8 theme-aligned swatches plus a hex input.

## Checklist
- [ ] Create src/components/menu-editor/IconPicker.tsx: Popover with search input + scrollable grid of curated icons; onChange(iconName)
- [ ] Create src/lib/curated-icons.ts: array of ~100 lucide icon names relevant to admin/ecommerce (Home, Users, Package, ShoppingCart, Settings, Bell, BarChart, etc.)
- [ ] Create src/components/menu-editor/ColorPicker.tsx: 8 preset swatches (theme tokens: primary, accent, success, warning, destructive, info, muted, current) + hex input; onChange(color|null)