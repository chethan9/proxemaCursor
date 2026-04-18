---
title: Refactor ProductsTab and OrdersTab (pure extraction)
status: todo
priority: high
type: chore
tags: [refactor]
created_by: agent
created_at: 2026-04-18
position: 43
---

## Notes
ProductsTab 863 lines, OrdersTab 811 lines. Extract filter bars, bulk actions, export buttons into siblings. Core table + pagination stays in main file.

Under `src/components/explore/products/`:
- ProductsFilterBar.tsx — search, status, category, stock, price range
- ProductsBulkActions.tsx — bulk publish/unpublish/delete

Under `src/components/explore/orders/`:
- OrdersFilterBar.tsx — search, status, payment method, total range, date range
- OrdersBulkActions.tsx — bulk status change

Shared (`src/components/explore/shared/`):
- ExportButton.tsx — uses lib/exportCsv.ts (depends on task-40)
- PaginationBar.tsx — page nav + page size selector + total count

Keep useBackgroundPagination wiring intact. Each main tab file under 400 lines after split.

## Checklist
- [ ] Create src/components/explore/shared/ExportButton.tsx
- [ ] Create src/components/explore/shared/PaginationBar.tsx
- [ ] Create src/components/explore/products/ProductsFilterBar.tsx
- [ ] Create src/components/explore/products/ProductsBulkActions.tsx
- [ ] Create src/components/explore/orders/OrdersFilterBar.tsx
- [ ] Create src/components/explore/orders/OrdersBulkActions.tsx
- [ ] Slim ProductsTab.tsx to <400 lines
- [ ] Slim OrdersTab.tsx to <400 lines
- [ ] check_for_errors