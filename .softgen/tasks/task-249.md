---
title: i18n foundation (next-i18next + locale routing + profiles.locale)
status: in_progress
priority: urgent
type: feature
tags: [i18n, infra]
created_by: agent
created_at: 2026-04-28T03:30:00Z
position: 249
---

## Notes

Foundation task — blocks B/C/D/E/F/G. Library: **next-i18next** (Pages Router compatible).

**Languages (10):** en (default), ar (RTL), es, fr, de, pt, hi, zh, ja, ru.

**Namespaces:** common, auth, sites, products, orders, billing, admin, settings.

**What goes in this task:**
1. Install `next-i18next`, `react-i18next`, `i18next`
2. Create `next-i18next.config.js` at project root with all 10 locales + default `en` + `localePath: ./public/locales`
3. Update `next.config.mjs` to import `i18n` from the config
4. Wrap `_app.tsx` with `appWithTranslation`
5. Create `public/locales/{en,ar,es,fr,de,pt,hi,zh,ja,ru}/common.json` (en populated with sidebar/common labels; others empty `{}` for now — populated in tasks D/E)
6. Add a small i18n helper `src/lib/i18n.ts` exporting an `LOCALES` array with `{code, name, nativeName, dir}` so RTL/switcher tasks can consume it
7. Migration: add `locale TEXT DEFAULT 'en'` to `profiles` + log to activity_log on change
8. `serverSideTranslations` example used in `index.tsx` to verify SSR works

**Out of scope:** UI switcher (Task C), RTL CSS (Task B), translating any strings (Tasks D/E), admin page (Task F).

## Checklist

- [ ] Install next-i18next + i18next + react-i18next
- [ ] Create next-i18next.config.js with 10 locales
- [ ] Wire i18n into next.config.mjs
- [ ] Wrap _app.tsx in appWithTranslation
- [ ] Create public/locales/{10 locales}/common.json (en populated, others empty)
- [ ] Add src/lib/i18n.ts with LOCALES metadata
- [ ] Migration: profiles.locale column
- [ ] Add serverSideTranslations to one page (index.tsx) to verify SSR

## Acceptance

- Visiting `/ar` and `/fr` returns 200 (no 404)
- `useTranslation('common')` returns translated string when key exists in en/common.json
- `profiles.locale` column exists with default 'en'