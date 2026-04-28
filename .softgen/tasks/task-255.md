---
title: Locale-aware formatters (date, number, currency)
status: in_progress
priority: medium
type: feature
tags: [i18n, formatters]
created_by: agent
created_at: 2026-04-28T03:30:00Z
position: 255
---

## Notes

Depends on Task 249. Replace ad-hoc date/number formatting with locale-aware helpers.

1. `src/lib/format-store-date.ts` accepts optional `locale` and uses `Intl.DateTimeFormat(locale, ...)`. Callers pass `useRouter().locale` or `i18n.language`.
2. `src/lib/format-number.ts` exports `formatNumber`, `formatCurrency`, `formatPercent`, `formatCompact` using `Intl.NumberFormat`.
3. Arabic decision: force Latin numerals (`ar-u-nu-latn`) for operator-dashboard consistency. If Arabic-Indic numerals are preferred later, remove the `resolveLocale` mapping.
4. Codebase audit/migration of `.toLocaleDateString()`, `.toLocaleString()`, raw currency template literals → deferred. Spans 50+ files. Migrate incrementally as pages get touched.
5. Chart formatters (sales trend, donut) — deferred with #4.

## Checklist

- [x] Update format-store-date to accept locale
- [x] Create format-number.ts (formatNumber + formatCurrency)
- [x] Confirm numeral system preference for Arabic (Latin numerals via `ar-u-nu-latn`)
- [ ] Audit + migrate ad-hoc formatters across codebase (deferred — incremental)
- [ ] Update chart axis/tooltip formatters (deferred with audit)

## Acceptance

- Dates/numbers/currency render correctly per locale
- Switching locale immediately updates formatted values