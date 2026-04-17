---
title: Upgrade data explorer - Excel-like table view with search, filters, export
status: done
priority: medium
type: feature
tags: [data-explorer, ui]
created_by: agent
created_at: 2026-04-17
position: 12
---

## Notes
Current Data tab in site detail page shows basic table of first 100 records with minimal columns. User wants full data viewing experience similar to Excel - all columns visible, searchable, filterable, sortable, with side panel for full record details including raw_data JSON.

Extract data explorer into reusable component at `src/components/data-explorer/` so it can be used across Products/Orders/Customers/Categories/Tags/Coupons tabs.

## Checklist
- [ ] Create `src/components/data-explorer/DataExplorer.tsx` - reusable paginated table with: search input, column visibility toggle, sort by any column, export to CSV button, row click opens side panel
- [ ] Create `src/components/data-explorer/DetailSidePanel.tsx` - slide-in panel (shadcn Sheet) showing all record fields grouped by category + collapsible raw_data JSON viewer
- [ ] Create `src/components/data-explorer/columns/` - column definitions per entity (productColumns.ts, orderColumns.ts, etc) - defines label, accessor, formatter, sortable, default visible
- [ ] Implement server-side pagination using Supabase `.range()` - fetch only visible page (50 per page default)
- [ ] Implement server-side search across key fields: products by name/sku, orders by order_number/customer name, customers by email/name
- [ ] Add status filter dropdowns where relevant (orders by status, products by stock_status)
- [ ] Add CSV export using browser Blob API - exports currently filtered/searched data
- [ ] Refactor site detail Data tab to use DataExplorer for each entity (products, orders, customers, categories, tags, coupons)
- [ ] Add "Full Raw Data" tab in detail panel showing pretty-printed JSON with copy button
