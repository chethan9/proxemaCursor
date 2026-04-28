---
title: RTL infrastructure (dir switching + logical CSS audit)
status: todo
priority: high
type: feature
tags: [i18n, rtl, css]
created_by: agent
created_at: 2026-04-28T03:30:00Z
position: 250
---

## Notes

Depends on Task 249. Make Arabic locale render right-to-left site-wide.

1. Add `dir={locale === 'ar' ? 'rtl' : 'ltr'}` and `lang={locale}` on `<html>` in `_document.tsx` (use `__NEXT_LOCALE` cookie or query) — or apply via `useEffect` in `_app.tsx` on `document.documentElement` for client switching.
2. Audit `src/styles/globals.css` — replace `left/right` with logical `inline-start/inline-end` where it makes sense.
3. Audit components for directional classes:
   - `ml-*` / `mr-*` → `ms-*` / `me-*` (Tailwind logical equivalents)
   - `pl-*` / `pr-*` → `ps-*` / `pe-*`
   - `text-left` / `text-right` → `text-start` / `text-end`
   - `border-l` / `border-r` → `border-s` / `border-e`
   - `rounded-l-*` / `rounded-r-*` → `rounded-s-*` / `rounded-e-*`
4. Directional icons (`ChevronRight`, `ArrowRight`, `ChevronLeft`, `ArrowLeft`) — wrap in a `<DirectionalIcon>` helper that swaps based on dir, OR add `rtl:rotate-180` class.
5. Test pages: AppSidebar, all `/sites/[id]/*`, all dialogs, ProductsTab, OrdersTab, dropdowns, popovers, charts.
6. Force Latin numerals globally via CSS `font-feature-settings` or by passing `numberingSystem: 'latn'` to formatters (Task G).

## Checklist

- [ ] dir/lang on html element switches with locale
- [ ] globals.css logical property pass
- [ ] Tailwind directional class audit (ml/mr → ms/me, etc.) across components
- [ ] DirectionalIcon helper or rtl:rotate-180 utility
- [ ] Visual QA in Arabic on: sidebar, dashboard, products, orders, product edit, dialogs

## Acceptance

- Switching to Arabic flips entire layout right-to-left
- No leaked LTR sections (sidebars on wrong side, icons pointing wrong way)
- English layout unchanged after the audit