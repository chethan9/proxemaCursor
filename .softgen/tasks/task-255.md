---
title: Locale-aware formatters (date, number, currency)
status: todo
priority: medium
type: feature
tags: [i18n, formatters]
created_by: agent
created_at: 2026-04-28T03:30:00Z
position: 255
---

## Notes

Depends on Task 249. Replace ad-hoc date/number formatting with locale-aware helpers.

1. Update `src/lib/format-store-date.ts` to accept locale and use `Intl.DateTimeFormat(locale, ...)`. Default locale from `useRouter().locale` or `i18n.language`.
2. New `src/lib/format-number.ts` exporting `formatNumber(value, locale, options)` and `formatCurrency(value, currency, locale)` using `Intl.NumberFormat`.
3. For Arabic, force Latin numerals: `new Intl.NumberFormat('ar', { numberingSystem: 'latn' })` — confirm with user if Arabic-Indic numerals preferred instead.
4. Audit usages of `.toLocaleDateString()`, `.toLocaleString()`, raw template literals with currency — migrate to helpers.
5. Charts (sales trend, donut) — pass formatted labels.

## Checklist

- [ ] Update format-store-date to accept locale
- [ ] Create format-number.ts (formatNumber + formatCurrency)
- [ ] Confirm numeral system preference for Arabic
- [ ] Audit + migrate ad-hoc formatters across codebase
- [ ] Update chart axis/tooltip formatters

## Acceptance

- Dates/numbers/currency render correctly per locale
- Switching locale immediately updates formatted values