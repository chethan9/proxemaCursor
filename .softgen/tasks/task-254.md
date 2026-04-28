---
title: Admin Languages page (/admin/languages)
status: todo
priority: medium
type: feature
tags: [i18n, admin]
created_by: agent
created_at: 2026-04-28T03:30:00Z
position: 254
---

## Notes

Depends on Tasks 249, 252, 253. Admin UI to manage locales + translations.

**New tables:**
```sql
CREATE TABLE locales (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  native_name TEXT NOT NULL,
  dir TEXT NOT NULL DEFAULT 'ltr' CHECK (dir IN ('ltr','rtl')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL REFERENCES locales(code) ON DELETE CASCADE,
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (locale, namespace, key)
);
```

Seed `locales` with the 10 entries.

**Page features:**
- Table of locales: code, native name, enabled toggle, default radio, completeness % (per namespace + total), last updated, "Edit translations" button
- Edit view per locale: searchable list of all keys grouped by namespace, English source on left, target translation on right (editable), needs_review badge, "mark reviewed" button
- "Import JSON" / "Export JSON" buttons per locale
- "Disable" hides locale from user-facing switcher
- Logged to activity_log: locale.enabled_changed, translation.updated, locale.set_default

**Runtime override:**
DB takes precedence over JSON files. Add an i18next backend that hits `/api/i18n/[locale]/[namespace]` which merges JSON file + DB rows. Cache in-memory + invalidate on translation update.

## Checklist

- [x] Migration: locales + translations tables, seed 10 locales
- [x] /admin/languages list page
- [ ] /admin/languages/[code] edit page
- [x] /api/admin/translations endpoints (list, update, bulk-import)
- [ ] /api/i18n/[locale]/[namespace] runtime endpoint (merges JSON + DB)
- [ ] Custom i18next backend that uses runtime endpoint
- [x] activity_log entries

## Acceptance

- Admin can disable a locale and it disappears from user switcher
- Admin can edit a translation and it takes effect on next page load
- Completeness % accurately reflects translated keys vs total keys