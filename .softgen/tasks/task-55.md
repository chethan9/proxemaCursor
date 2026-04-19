---
title: Products bulk actions - price, stock, category, status
status: in_progress
priority: medium
type: feature
tags: [bulk-ops, products, ui]
created_by: agent
created_at: 2026-04-19
position: 55
---

## Notes

**Backend is DONE.** `/api/cron/process-bulk-jobs.ts` fully supports:
- update_product_price (operations: set, increase_pct, decrease_pct, increase_fixed, decrease_fixed, set_sale)
- update_product_stock (operations: set, adjust, set_status)
- update_product_status (publish/draft/pending/private)
- assign_product_categories (modes: add, remove, replace)
- delete_products (force flag)

**Frontend is NOT DONE.** A full_file_rewrite on ProductsTab.tsx truncated and stripped the bulk UI that was added. Current ProductsTab has quickEdit working but NO bulk selection/actions UI.

**Handoff: to complete in fresh session:**
1. Add to ProductsTab.tsx (mirroring OrdersTab.tsx pattern):
   - `selectedIds: Set<string>` state + `toggleSelect` callback
   - Row checkboxes in list view; overlay checkbox on grid/compact cards
   - "Select all visible" master checkbox in table header
   - Bulk action bar when selectedIds.size > 0 (shows count, Mark status submenu, Update price, Update stock, Assign categories, Delete)
   - 5 confirm dialogs (one per action type) with form inputs
   - `submitBulk` calling `createBulkJob` with correct payload shape per action type
   - MAX_BULK=500 limit like orders
2. Reference OrdersTab.tsx lines for selection/dialog patterns (already built)
3. Payload types in src/services/bulkJobService.ts (BulkJobPayload discriminated union)

## Checklist
- [x] Backend worker supports all 5 product bulk job types
- [ ] Selection checkboxes on list view rows
- [ ] Selection checkbox overlay on grid/compact cards
- [ ] Bulk action bar with dropdown/buttons
- [ ] Price update dialog (operation select + value input)
- [ ] Stock update dialog (operation select + value/status input)
- [ ] Status update dialog
- [ ] Category assign dialog (mode + multi-select from store categories)
- [ ] Delete confirm dialog
- [ ] submitBulk wired to createBulkJob for each type
- [ ] check_for_errors