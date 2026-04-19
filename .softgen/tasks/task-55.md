---
title: Products bulk actions - price, stock, category, status
status: todo
priority: medium
type: feature
tags: [bulk-ops, products, ui]
created_by: agent
created_at: 2026-04-19
position: 55
---

## Notes
Extends bulk job infrastructure to products. Reuses bulk_jobs table, worker cron, toast, and history page built in tasks 51-54.

New job types: `update_product_price`, `update_product_stock`, `update_product_status`, `assign_product_categories`, `delete_products`.

Price update supports: set to X, increase by %, decrease by %, increase by fixed, decrease by fixed, set sale_price to X. Handled via payload.operation field.

Stock update: set to N, adjust by ±N, enable/disable manage_stock, set stock_status.

Category: assign (add), unassign (remove), replace all.

Selection UI pattern mirrors OrdersBulkBar. Confirm modal shows operation preview: "Increase regular_price by 10% for 47 products".

## Checklist
- [ ] Extend worker dispatcher in process-bulk-jobs.ts: add handlers for each new product job_type
- [ ] Implement processUpdateProductPrice: supports set/percent/fixed operations, uses woo-client PUT /products/{id}
- [ ] Implement processUpdateProductStock: supports set/adjust/toggle_manage operations
- [ ] Implement processUpdateProductStatus: publish/draft/pending toggle
- [ ] Implement processAssignProductCategories: read current categories, merge/remove/replace based on payload.mode
- [ ] Implement processDeleteProducts: PUT with force=true, local row marked deleted
- [ ] Update CHECK constraint on bulk_jobs.job_type to include new types (via migration)
- [ ] Add selection state + checkboxes to ProductsTab list and grid views (grid: checkbox overlay top-left of card)
- [ ] Create `src/components/explore/ProductsBulkBar.tsx` mirroring OrdersBulkBar
- [ ] Create `src/components/explore/BulkPriceDialog.tsx`: operation selector (set/±%/±fixed), value input, live preview of min/max new prices
- [ ] Create `src/components/explore/BulkStockDialog.tsx`: operation selector, value input
- [ ] Create `src/components/explore/BulkCategoryDialog.tsx`: mode selector (add/remove/replace), category multi-select
- [ ] Wire all dialogs to bulkJobService.createJob with proper payload
- [ ] Verify BulkJobsToast and history page handle new job types (display job_type labels nicely)
- [ ] check_for_errors