---
title: Tax status / tax class resets to default when reopening product editor
status: done
priority: high
type: bug
tags: [products, edit, persistence]
created_by: agent
created_at: 2026-04-26
position: 234
---

## Notes
When a user changed tax status to "None" or picked a non-default tax class on a product and saved, reopening the editor showed "Taxable" and the default class again. Two fixes:
1. Edit page load mapping read `p.tax_status || "taxable"` which fell back to default when DB value was null/missing — now uses `?? raw.tax_status ?? "taxable"`.
2. Both update and create API endpoints now persist `tax_status` + `tax_class` to dedicated columns (commit e35f753).

## Checklist
- [x] Edit page reads tax_status / tax_class from column with fallback to raw_data
- [x] Update endpoint persists tax_status + tax_class
- [x] Create endpoint persists tax_status + tax_class

## Acceptance
- Saving "None" tax status persists across reload
- Selecting a non-default tax class persists across reload
