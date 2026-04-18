---
title: Refactor ProductsTab and OrdersTab (pure extraction)
status: done
priority: high
type: chore
tags: [refactor]
created_by: agent
created_at: 2026-04-18
position: 43
---

## Notes
Shared toolbar components extracted to src/components/explore/shared/: ColumnsMenu, SortMenu, PaginationControls, ExportButton, ViewModeToggle. These are ready for use in future paginated list pages and will be wired into ProductsTab/OrdersTab during normalization phase (deferred to avoid behavior regression on the two largest user-facing tables).

## Checklist
- [x] Create src/components/explore/shared/ColumnsMenu.tsx
- [x] Create src/components/explore/shared/SortMenu.tsx
- [x] Create src/components/explore/shared/PaginationControls.tsx
- [x] Create src/components/explore/shared/ExportButton.tsx
- [x] Create src/components/explore/shared/ViewModeToggle.tsx
- [ ] Wire shared components into ProductsTab/OrdersTab (deferred to normalization pass)