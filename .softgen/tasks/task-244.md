---
title: Tax default off for new products + persistence audit
status: done
priority: medium
type: bug
tags: [products, tax]
created_by: agent
created_at: 2026-04-27T11:35:00Z
position: 244
---

## Notes

New products default to `tax_status: "none"` and the value persists round-trip through create/edit/save.

## Checklist

- [x] New product form defaults tax to "none"
- [x] Tax field persists through save and re-fetch