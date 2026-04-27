---
title: Variant bulk update accepts sale price higher than regular price
status: done
priority: high
type: bug
tags: [products, variations, validation]
created_by: agent
created_at: 2026-04-27T11:00:00Z
position: 236
---

## Notes

When bulk updating variant prices, the form accepted a sale price greater than or equal to the regular price. Same gap existed at form-level validation and inline cell editing.

Three layers of guard now in place:
1. Bulk dialog (VariationsTable.tsx applyBulk) — blocks bulk apply with clear error listing offending rows
2. Inline cell red ring (VariationsTable.tsx) — visual warning when sale >= regular per row
3. Form-level (productValidation.ts validateVariation) — blocks publish/save with field error

## Checklist

- [x] Bulk dialog validates sale < regular before apply
- [x] Inline cell shows red ring when sale >= regular
- [x] Form validation blocks save: every variation must have sale price < regular price
- [x] Test: bulk-set 999 sale across 33-priced rows blocks with clear error