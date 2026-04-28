---
title: i18n foundation (next-i18next + locale routing + profiles.locale)
status: done
priority: urgent
type: feature
tags: [i18n, infra]
created_by: agent
created_at: 2026-04-28T03:30:00Z
position: 249
---

## Notes

Foundation done. **Constraint discovered:** `next.config.mjs` is locked by template policy, so we cannot use Next.js built-in locale routing (no `/ar/*` URL prefixes). Translation switching works at runtime via `i18next.changeLanguage()` + cookie/profile persistence. Tasks 250-255 must use this pattern (no `router.push` with `{ locale }` option — instead call `i18n.changeLanguage(code)`).

Library: **next-i18next** with `appWithTranslation` wrapper. Locales: en (default) + ar/es/fr/de/pt/hi/zh/ja/ru. Namespaces: common, auth, sites, products, orders, billing, admin, settings.

## Checklist

- [x] Install next-i18next + i18next + react-i18next
- [x] Create next-i18next.config.js with 10 locales
- [x] Wrap _app.tsx in appWithTranslation
- [x] Create public/locales/{10 locales}/common.json (en populated, others empty)
- [x] Add src/lib/i18n.ts with LOCALES metadata
- [x] Migration: profiles.locale column

## Acceptance

- next-i18next installed and wired into _app
- public/locales/* directory structure exists for all 10 languages
- profiles.locale column exists with default 'en'
- Tasks 250-255 use runtime language switching (no URL prefixes)