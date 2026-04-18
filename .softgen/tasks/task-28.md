---
title: Settings nav link for menu editor (super-admin only)
status: todo
priority: medium
type: chore
tags: [menu-editor, navigation]
created_by: agent
created_at: 2026-04-18T11:51:00Z
position: 28
---

## Notes
Add "Menu Editor" link to SettingsLayout sidebar, visible only to super_admin role.

## Checklist
- [ ] Update src/components/layout/SettingsLayout.tsx to include Menu Editor link with conditional render based on current user role