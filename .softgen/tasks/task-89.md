---
title: Restore product row expansion
status: done
priority: high
type: bug
tags: [explore, products, regression]
created_by: agent
created_at: 2026-04-20
position: 89
---

## Notes

Clicking a product row in the table view of the Products explore tab no longer expands to show the inline editor (`ProductRowExpanded`). The state (`expandedRowId`), click handler, and component import are all present in `src/components/explore/ProductsTab.tsx`, but the conditional expansion `<TableRow>` that renders `<ProductRowExpanded ... />` beneath the main row is missing from the `React.Fragment` — it was removed in a recent refactor.

The expansion row must:
- Render only when `expandedRowId === p.id`
- Span all visible columns (checkbox + `visibleColList.length`)
- Not be clickable itself (stopPropagation) so interacting inside doesn't collapse it
- Close via the `onClose` handler passed to `ProductRowExpanded`
- Wire `onSaved` to update the row optimistically and invalidate the products query

The quick-edit dialog flow (`quickEditProduct`) on the grid/compact views stays as-is — this bug only affects the table view.

## Checklist

- [ ] Inside the table view's row map, when `isExpanded` is true, render a second `<TableRow>` inside the fragment with a single `<TableCell colSpan={visibleColList.length + 1}>` containing `<ProductRowExpanded product={p} storeUrl={storeUrl} onClose={() => setExpandedRowId(null)} onSaved={...} />`
- [ ] Expanded row has no padding on the cell, a subtle top border separator, and matches the `bg-muted/30` treatment already applied to the parent row when expanded
- [ ] `onSaved` invalidates the products query (`queryClient.invalidateQueries({ queryKey: ["products", storeId] })`) and keeps the row expanded so the user sees updated values
- [ ] Clicking anywhere inside the expansion area does NOT collapse the row (container already has `onClick={(e) => e.stopPropagation()}`, verify it still works)
- [ ] Clicking the parent row again collapses the expansion (existing toggle logic)

## Acceptance

- Clicking a product row in table view expands it inline to show price, stock, and action controls.
- Editing price/stock and clicking Save updates the row and keeps the expansion open with the new values.
- Clicking the row header again collapses the expansion.