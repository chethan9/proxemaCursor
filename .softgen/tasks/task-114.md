---
title: Menu editor — icon picker and compact UX polish
status: todo
priority: high
type: feature
tags: [menu-editor, admin, ux]
created_by: agent
created_at: 2026-04-21T07:35:00Z
position: 114
---

## Notes
Extend current menu editor (`src/pages/settings/menu-editor.tsx`) so admins can also edit the icon for each item (currently only label, group, hidden, reorder). Keep the compact single-panel flat-list layout from task-110.

Requirements:
- Each row shows a clickable icon button (current icon) that opens a popover with the full icon grid from `src/components/menu-editor/IconPicker.tsx` (already exists, reuse)
- Optional icon color picker already exists (`ColorPicker.tsx`) — surface as a secondary small swatch next to the icon button
- Add a second tab/section inside the editor for "Site Menu" — same compact row UI but editing `SITE_MENU_REGISTRY` (Home/Orders/Products/etc) per role, so the inner sidebar from task-113 is also customizable
- Scope selector stays: role tabs at top (Super Admin, Admin, User)
- Mobile/compact: keep row height tight (~36px), inline controls only, no modals except the icon picker popover
- Reset-row button restores label + icon + color + group + visibility to registry defaults

Files to touch:
- `src/pages/settings/menu-editor.tsx` (add icon picker trigger, color swatch, Global/Site tabs)
- `src/services/menuConfigService.ts` (ensure it can persist icon + iconColor overrides — check current schema)
- `src/lib/menu-merge.ts` (already resolves icon + iconColor — verify)

Acceptance criteria: clicking the icon on any row opens the IconPicker, selecting a new icon persists after save, and the sidebar reflects the change on next render.

## Checklist
- [ ] Each row in menu editor has a clickable icon button that opens IconPicker popover; selecting an icon updates the row
- [ ] Each row has a color swatch button next to the icon that opens ColorPicker; clearing it reverts to default
- [ ] Editor has two tabs: "Global Menu" (current) and "Site Menu" (edits SITE_MENU_REGISTRY items per role)
- [ ] Reset-row button restores label, icon, iconColor, group, and hidden state to registry defaults
- [ ] Changes persist via menuConfigService and are reflected in both outer and inner sidebars after save

## Acceptance
- Admin changes the "Sync Runs" icon from RefreshCw to Activity → saves → sidebar immediately shows the new icon without page reload.
- Admin customizes "Orders" inside the Site Menu tab → visiting a site's /orders page shows the new label/icon in the inner sidebar.