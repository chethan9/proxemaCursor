---
title: i18n string extraction pass 1 — shell + auth + settings
status: todo
priority: high
type: chore
tags: [i18n, strings]
created_by: agent
created_at: 2026-04-28T03:30:00Z
position: 252
---

## Notes

Depends on Task 249. Extract every hardcoded English string in:

- `src/components/layout/AppSidebar.tsx` (nav labels, badges, tooltips)
- `src/components/layout/SiteSidebar.tsx`, `SettingsLayout.tsx`, `AppLayout.tsx`
- `src/pages/auth/*` (login, signup, forgot-password, reset-password, confirm-email, bootstrap)
- `src/pages/settings/*` (profile, users, roles, theme, branding, plans, subscriptions, payment-methods, my-activity, menu-editor)
- Top-level dialogs: AddSiteDialog, EditSiteDialog, ProductTypeDialog, IncompleteSiteDialog, PlanDialog, PlanChangeDialog
- Toaster messages from these flows

Strings → `public/locales/en/{common,auth,settings,sites}.json`. Run AI translation pass for ar/es/fr/de/pt/hi/zh/ja/ru. Mark machine translations with `__needs_review: true` flag (or separate `_meta` namespace) so admin Task F can surface them.

## Checklist

- [ ] AppSidebar + SiteSidebar + layouts → common.json
- [ ] auth/* pages → auth.json
- [ ] settings/* pages → settings.json
- [ ] Dialogs in scope → respective namespaces
- [ ] AI-translate to 9 other languages
- [ ] All replaced strings use `useTranslation('ns').t('key')`

## Acceptance

- Switching to any non-English locale shows translated sidebar, auth pages, and settings
- No raw English visible in extracted areas