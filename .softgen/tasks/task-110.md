---
title: Developer submenu + simplified menu editor
status: done
priority: high
type: feature
tags: [sidebar, menu-editor, ux]
created_by: agent
created_at: 2026-04-21T06:40:00Z
position: 110
---

## Notes

Two related changes to sidebar and menu management.

**1. Add "Developer" parent menu with submenu:**
Currently Sync Runs, Webhooks, Activity, API are rendered as flat items (Operations + Developer groups, no visible group label). User wants a single collapsible parent labeled "Developer" that expands to show these four children.

Registry changes (`src/lib/menu-registry.ts`):
- Move `sync-runs`, `webhooks`, `webhooks-activity` from `defaultGroup: "Operations"` into `defaultGroup: "Developer"`.
- Keep `api` in Developer.
- Remove "Operations" from `DEFAULT_GROUPS` (now empty); ensure "Developer" stays.
- Use an icon for the Developer parent group (e.g., `Code2` or `Terminal` — add to ICON_MAP).

Sidebar rendering (`src/components/layout/AppSidebar.tsx`):
- Add collapsible group support: when a group has > 0 visible children, render the group as a clickable row with chevron that toggles expanded state. Persist expanded/collapsed state per group in localStorage (`sidebar-group-expanded:<id>`).
- Active child should auto-expand its parent on mount.
- In collapsed sidebar mode, render group icon as a popover trigger that shows children on hover/click (similar to existing site overflow popover).
- "Stores" group stays as-is (special rendering with site list) — only non-store groups get collapsible treatment.
- Apply the same pattern to Administration (Users, Roles), System (Settings) so sidebar becomes consistently hierarchical.

**2. Simplify menu editor (`src/pages/settings/menu-editor.tsx`):**
Current editor: nested dnd-kit contexts, color picker, icon picker, custom group creation, hidden expand/collapse, unassigned banner — too complex and reportedly broken.

Redesign as compact single-panel editor:
- Role tabs at top (Super Admin / Admin / User) — unchanged.
- Single flat scrollable list of all menu items for that role, grouped by parent with a small group header row.
- Each row: drag handle · icon (read-only, from registry) · label (editable inline) · group dropdown (select which parent group to belong to) · show/hide toggle (eye icon) · optional reset-to-default button per row.
- One "Add custom group" button at top; custom groups get a delete button.
- Remove: per-item color picker (move to a single "Advanced" popover if really needed, but default hide), nested expand/collapse state, separate unassigned banner (auto-assign new items to a visible "New" group at top with a small badge).
- Save / Reset buttons stick to the bottom of the card.
- Live preview strip on the right (or below on mobile) showing the resulting sidebar tree as static text — updates as user edits.
- Width: cap editor content at ~720px for readability; remove the 5xl max-width sprawl.

Keep the underlying `menu_configs` table + `MenuNode` schema unchanged so existing saved configs stay valid.

## Checklist

- [ ] Move sync-runs, webhooks, webhooks-activity into "Developer" group in menu registry; remove empty "Operations" from DEFAULT_GROUPS
- [ ] Add Code2/Terminal icon to ICON_MAP and assign as Developer group icon
- [ ] AppSidebar: render non-Stores groups as collapsible rows with chevron, group label, and icon; persist expanded state in localStorage; auto-expand group containing active route
- [ ] AppSidebar collapsed mode: group icon opens popover listing children
- [ ] Menu editor: replace nested dnd + expand/collapse with single flat list per role; row shows drag handle, registry icon, inline label input, group dropdown, show/hide toggle, reset button
- [ ] Menu editor: auto-route newly-discovered registry items into a "New" group at top (badge) instead of separate banner
- [ ] Menu editor: compact layout capped at ~720px, sticky Save/Reset footer, optional live preview of resulting tree
- [ ] Menu editor: keep MenuNode schema + menu_configs table unchanged so existing configs load correctly
- [ ] Verify existing saved menu_configs still render correctly after Operations→Developer migration (items auto-land in "New" group if not found)

## Acceptance

- Sidebar shows a "Developer" parent with chevron; clicking expands to Sync Runs, Webhooks, Activity, API.
- Collapsed sidebar: hovering Developer icon shows the four children in a popover.
- Admin → Settings → Menu Editor loads without errors, shows a compact flat list per role, lets you rename/reorder/show-hide/assign group for every item, and saves successfully.