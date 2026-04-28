---
title: Locale switcher UI (profile menu + settings + public footer)
status: done
priority: high
type: feature
tags: [i18n, ui]
created_by: agent
created_at: 2026-04-28T03:30:00Z
position: 251
---

## Notes

Reusable `LocaleSwitcher` component (variants: menu/select/compact) + sidebar profile sub-menu + settings/profile card + pricing header. Auto-load on login lives in `_app.tsx` `LocaleDirSync` (reads `profile.locale` and applies via `i18n.changeLanguage`). Activity log entry `profile.locale_changed` written.

Auth pages (`/auth/login`, `/auth/signup`) intentionally deferred — strings will be extracted in Task 252 and the switcher can be added in the same pass.

## Checklist

- [x] LocaleSwitcher component (menu / select / compact variants)
- [x] AppSidebar profile menu sub-menu
- [x] settings/profile card
- [x] pricing header
- [x] Auto-load from profile.locale on login (in LocaleDirSync)
- [x] Persist to NEXT_LOCALE cookie + profiles.locale on change
- [x] Activity log: profile.locale_changed
- [ ] Auth pages footer — bundled into Task 252

## Acceptance

- User can switch from sidebar profile menu, /settings/profile, or pricing header
- Choice persists across sessions for logged-in users (auto-loaded from profile.locale)
- Anonymous switch persists via NEXT_LOCALE cookie