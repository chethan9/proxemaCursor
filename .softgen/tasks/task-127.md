---
title: Customers list page revamp to explorer standard
status: todo
priority: high
type: feature
tags: [customers, list, ui-consistency, explorer]
created_by: agent
created_at: 2026-04-21T20:00:00Z
position: 127
---

## Notes

Customers list at `/sites/[id]/customers` still uses its original layout. Revamp to match the orders/products explorer standard defined in `docs/UI_REFERENCE.md`.

Reference files:
- `src/components/explore/OrdersTab.tsx` — toolbar layout, table markup, draggable columns
- `src/components/explore/OrderRowExpanded.tsx` — expanded row pill actions
- `src/components/explore/TaxonomyTab.tsx` — recent minimal explorer pattern (task 126)
- `docs/UI_REFERENCE.md` — canonical spec

File to rewrite: `src/pages/sites/[id]/customers.tsx`

## Checklist

- [ ] Remove page header block (`Customers` title + `1,205 total · synced from WooCommerce` subtitle)
- [ ] Build single-row toolbar: Filter chip (left) → Sort dropdown → centered Search input → Columns menu → Pagination controls (rows-per-page + ‹ ›) → `+ New customer` primary button (right)
- [ ] Clone table styling from OrdersTab: white `bg-background` surface, `bg-muted/30` header row, border-border dividers, row hover `bg-muted/20`
- [ ] Column reorder via HTML5 drag on header cells (grip dots indicator)
- [ ] Column resize handles on header cells
- [ ] Sort chevron indicators in sortable headers
- [ ] Expanded row renders inside single `<TableCell colSpan>` with no gap seam (matching task 126)
- [ ] Expanded row action buttons use compact pill style (`h-7 px-2.5 rounded-full ring-1 ring-inset`): primary "Edit customer", neutral "View details" / "Send email", rose-tinted "Delete"
- [ ] Filter chip opens popover with country + role filters
- [ ] Sort dropdown offers: Name, Username, Last active, Date registered, Orders, Total spend, AOV, City, Country
- [ ] Keep existing search logic (name/email/username/phone/city)
- [ ] Keep existing expanded row content (last 3 orders, actions) — only restyle

## Acceptance

- Customers list visually matches orders list (toolbar, table, expanded seam)
- All existing search/sort/filter/create functionality still works
- Pill actions in expanded row match orders expanded widget