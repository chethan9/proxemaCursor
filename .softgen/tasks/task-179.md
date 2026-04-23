---
title: Expand rows-per-page dropdown to include 1000
status: done
priority: medium
type: feature
tags: [ux, tables, pagination]
created_by: agent
created_at: 2026-04-23
position: 179
---

## Notes
Rows-per-page dropdown currently offers 25 / 50 / 100 / 200 / 500. Users with large stores (2k+ orders, 5k+ customers) want fewer page-flips when scanning. 1000 is the safe ceiling without virtualization — matches Supabase's PostgREST default `db.max-rows: 1000` so we can't silently over-fetch.

The dropdown is rendered in the data explorer tables. Grep for the existing array `[25, 50, 100, 200, 500]` — likely lives in `src/components/explore/ProductsTab.tsx`, `OrdersTab.tsx`, `TaxonomyTab.tsx`, and `src/pages/sites/[id]/customers.tsx`. Apply the same change to all of them so the UX is consistent across Products / Orders / Customers / Categories / Tags.

Don't exceed 1000 here — anything larger needs virtualization (see task-180).

## Checklist
- [ ] Find all page-size dropdowns that currently show 25/50/100/200/500 across Products, Orders, Customers, Categories, Tags tables
- [ ] Add 1000 as a new option at the end of each dropdown (final order: 25, 50, 100, 200, 500, 1000)
- [ ] Keep 100 as the default selection — don't change starting page size
- [ ] Verify the Supabase query paths (fetchProducts / fetchOrders / fetchCustomers / fetchCategories / fetchTags) respect pageSize=1000 without silently truncating
- [ ] When 1000 is selected on Orders, scroll through a full page to confirm no console errors and acceptable render time (~1-2s first paint is OK; jank is not)

## Acceptance
- Selecting 1000 on the Orders table with 2700+ orders renders all 1000 rows on one page, pagination shows "1-1000 of 2700"
- Same option appears on Products, Customers, Categories, Tags tables
- No silent truncation — row count in table matches pageSize exactly