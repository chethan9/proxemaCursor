---
title: RTL infrastructure (dir switching + logical CSS audit)
status: in_progress
priority: high
type: feature
tags: [i18n, rtl, css]
created_by: agent
created_at: 2026-04-28T03:30:00Z
position: 250
---

## Notes

Infrastructure (dir switching + globals.css audit) shipped. Component-level Tailwind class audit (ml/mr → ms/me, etc.) is deferred — will be done incrementally during string extraction passes (Tasks 252, 253) since both touch the same files.

1. `_document.tsx` has no-flash script that sets html `lang` and `dir` from `NEXT_LOCALE` cookie before paint.
2. `_app.tsx` has `<LocaleDirSync />` that updates dir/lang reactively when `i18n.language` changes.
3. `globals.css` directional properties (left/right, padding-left/right, border-left/right) replaced with logical equivalents (inline-start/inline-end, padding-inline, border-inline-start/end).
4. Tailwind class audit (`ml-/mr-` → `ms-/me-`, `text-left/right` → `text-start/end`, `rounded-l-/r-` → `rounded-s-/e-`, `rtl:rotate-180` on directional icons) — done as part of Tasks 252/253.

## Checklist

- [x] dir/lang on html element switches with locale (no-flash script + reactive effect)
- [x] globals.css logical property pass
- [ ] Tailwind directional class audit — bundled into Tasks 252/253
- [ ] DirectionalIcon helper or rtl:rotate-180 utility — applied during component string extraction
- [ ] Visual QA in Arabic on: sidebar, dashboard, products, orders, product edit, dialogs — after Tasks 252/253

## Acceptance

- Switching to Arabic flips html dir to rtl (verified)
- globals.css uses logical properties (no left/right leaks in base styles)
- Component-level audit follows in extraction passes