---
title: Split Theme (personal) from Branding (white-label)
status: done
priority: high
type: feature
tags: [settings, theme, branding, permissions]
created_by: agent
created_at: 2026-04-23T15:00:01Z
position: 171
---

## Notes
Previously `/settings/theme` was gated behind `SETTINGS_MANAGE` and combined style preset + brand identity + audit log. Split into two pages so visibility can be controlled via the menu editor.

## Checklist
- [x] `/settings/theme` — Style Preset picker (Classic / Modern) with Save/Reset.
- [x] `/settings/branding` — Brand Identity (app name, logo upload) + Change History from `branding_audit_log`.
- [x] Both pages accessible to all users (gating controlled via menu editor, not hardcoded).
- [x] SettingsLayout shows Theme + Branding under Appearance group.
- [x] Removed theme/branding from main sidebar registry — they're settings sub-pages, no longer duplicated under other groups.
- [x] Aligned with actual schema (`brand_name`, `theme_preset`, `branding_audit_log`).

## Acceptance
- Theme page shows Style Preset picker only.
- Branding page shows Brand Identity + Change History.
- Neither page appears duplicated in the main sidebar.
- Menu Editor can toggle visibility per role.