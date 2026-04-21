---
title: Menu editor — Inline/Panel toggle button per group
status: done
priority: high
type: feature
tags: [menu-editor, sidebar]
created_by: agent
created_at: 2026-04-21T11:30:00Z
position: 115
---

## Notes
In `src/pages/settings/menu-editor.tsx`, each group section header (Stores, Management, Developer, Administration, System) must show a visible pill button to toggle `displayMode` between `inline` and `panel`. Root section (Top level) must NOT show it.

Current state: header only shows arrows, name, count, spacer, and delete button. The `toggleGroupMode` function already exists but no button calls it.

Implementation detail:
- Place the button AFTER the `<div className="flex-1" />` spacer and BEFORE the `sec.deletable` delete button
- Condition: `sec.id !== ROOT_ID`
- Look up the group from `groups` array by `sec.id` to read `displayMode`
- Button variant: `default` when panel, `outline` when inline
- Label: "Panel" or "Inline" next to PanelRight icon
- Size: h-6 px-2 text-[10px] gap-1

Verify AppSidebar.tsx already handles `displayMode === "panel"` by rendering a persistent second column (already implemented).

## Checklist
- [ ] Add Inline/Panel pill button to each non-root group section header in menu editor
- [ ] Button reflects current displayMode (Panel = filled variant, Inline = outline variant)
- [ ] Clicking toggles displayMode and marks editor dirty
- [ ] After Save, sidebar group set to Panel opens as persistent second column (already wired in AppSidebar)

## Acceptance
- Open /settings/menu-editor as super admin → each group (Stores, Management, Developer, Administration, System) shows a visible "Inline"/"Panel" pill button next to the count
- Click Panel on Developer → Save → clicking Developer in sidebar opens a fixed second column with Sync Runs / Webhooks / Activity / API