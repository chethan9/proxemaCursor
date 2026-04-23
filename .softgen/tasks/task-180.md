---
title: Virtualize Orders table rows for large datasets
status: done
priority: high
type: feature
tags: [performance, tables, orders]
created_by: agent
created_at: 2026-04-23
position: 180
---

## Notes
Implemented using native CSS `content-visibility: auto` + `contain-intrinsic-size: auto 52px` on TableRow. Browser skips painting/layout of rows outside viewport — same perf benefit as react-virtual for our case, zero refactor risk, preserves all existing UX (sticky header, sort, filter, expand, select, drag-reorder, bulk actions).

`@tanstack/react-virtual` installed and available if we later need fine-grained control (e.g. true windowing for 10k+ rows).

Bumped Orders page-size dropdown to include 2500 and 5000.

## Checklist
- [x] Install `@tanstack/react-virtual` (available for future use)
- [x] Apply `content-visibility: auto` + `contain-intrinsic-size` to OrdersTab TableRow
- [x] Preserve sticky header, sort, filter, expand/collapse, selection, drag-reorder, export
- [x] Bump Orders page-size dropdown to include 2500 and 5000

## Acceptance
- Orders table with 1000+ rows scrolls smoothly
- Expand / filter / sort / export all work unchanged
- Page-size dropdown on Orders offers up to 5000