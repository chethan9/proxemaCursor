---
title: Split Theme (personal) from Branding (white-label)
status: in_progress
priority: high
type: feature
tags: [settings, theme, branding, permissions]
created_by: agent
created_at: 2026-04-23T15:00:01Z
position: 171
---

## Notes
Currently `/settings/theme` is gated behind `SETTINGS_MANAGE` and contains everything (app name, logo upload, theme preset, audit log). When branding was restricted recently, the whole theme page disappeared for non-admins.

User wants:
- **Theme page** (`/settings/theme`) — personal UI preferences (light/dark/system mode), available to ALL authenticated users
- **Branding page** (`/settings/branding`) — white-label config (app name, logo, theme preset, audit log), super-admin only
- Both registered in `menu-registry.ts` so visibility is editable via Menu Editor, not hardcoded

## Checklist
- [ ] Create `src/pages/settings/branding.tsx` — move app name, logo upload, theme preset picker, audit log from current theme.tsx here. Gate with `requirePermission` = super admin check.
- [ ] Refactor `src/pages/settings/theme.tsx` — replace current content with personal theme preferences: light/dark/system mode selector (uses existing `ThemeProvider` / next-themes), page explains it's a per-user choice. Remove `requirePermission`.
- [ ] Update `src/components/layout/SettingsLayout.tsx` — add Branding nav item (super-admin only), remove gate from Theme so all users see it.
- [ ] Register both in `src/lib/menu-registry.ts` — theme item (all users), branding item (superAdminOnly). So menu editor can manage them.
- [ ] Ensure `BrandingProvider` still works unchanged — branding edits still save to `app_settings` global row.

## Acceptance
- Non-admin user logs in → sees Theme in Settings, can toggle light/dark mode, does NOT see Branding
- Super admin sees both Theme and Branding
- Menu Editor lists both as configurable entries