---
title: Locale switcher UI (profile menu + settings + public footer)
status: todo
priority: high
type: feature
tags: [i18n, ui]
created_by: agent
created_at: 2026-04-28T03:30:00Z
position: 251
---

## Notes

Depends on Task 249. Three placements:

1. **Profile dropdown** in `AppSidebar.tsx` — language item with current native name, opens dialog/sub-menu listing all enabled locales (read from admin page in Task F; until then, all 10).
2. **`/settings/profile`** — language select field, persists to `profiles.locale`.
3. **Public pages footer** (`/pricing`, `/auth/login`, `/auth/signup`) — small dropdown bottom-right.

Switching: call `router.push(router.asPath, router.asPath, { locale: newLocale })` and write to `profiles.locale` if logged in, else cookie `NEXT_LOCALE`.

## Checklist

- [ ] LocaleSwitcher component (reusable, accepts `variant: 'menu' | 'select' | 'compact'`)
- [ ] Wire into AppSidebar profile menu
- [ ] Wire into settings/profile.tsx
- [ ] Wire into pricing + auth public pages
- [ ] Persist to profiles.locale on change for logged-in users
- [ ] Activity log: profile.locale_changed

## Acceptance

- User can switch language from profile menu, settings, or public footer
- Choice persists across sessions for logged-in users