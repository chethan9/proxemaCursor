---
title: Wire ProductQuickEdit sheet to grid and compact views
status: done
priority: high
type: feature
tags: [explore, products, grid]
created_by: agent
created_at: 2026-04-19
position: 50
---

## Notes
`ProductQuickEdit.tsx` (a Sheet) already exists and is used for the list/table view's expanded row. Grid and compact views in `ProductsTab.tsx` currently `onClick={() => setExpandedRowId(p.id)}` but nothing renders for them — clicks are dead.

Goal: clicking a grid/compact card opens the existing ProductQuickEdit sheet, same component currently used in table expanded row. No new UI, just wiring.

Key bits in ProductsTab.tsx:
- Grid card: line with `onClick={() => setExpandedRowId(p.id)}` around each product card (both compact and standard grid)
- Table expanded row uses `ProductRowExpanded` with ProductQuickEdit elements; for grid we use ProductQuickEdit directly as a modal Sheet

Implementation:
- Add state `const [quickEditProduct, setQuickEditProduct] = useState<ProductRow | null>(null)`
- In grid/compact onClick: `setQuickEditProduct(p)` instead of `setExpandedRowId(p.id)`
- Render `<ProductQuickEdit product={quickEditProduct} open={!!quickEditProduct} onClose={() => setQuickEditProduct(null)} onSaved={(updated) => { /* invalidate query */ setQuickEditProduct(null); }} />` at the bottom of the component, outside the Card
- onSaved: invalidate the products query via queryClient so the list refreshes with new price/stock. Import `useQueryClient` from @tanstack/react-query and call `queryClient.invalidateQueries({ queryKey: queryKeys.products(storeId) })` or narrower match

Leave table view behavior unchanged (still expands inline via setExpandedRowId + ProductRowExpanded).

## Checklist
- [ ] Add `quickEditProduct` state in ProductsTab.tsx
- [ ] Add `useQueryClient` import and handler to invalidate product queries after save
- [ ] Wire compact grid card `onClick` to `setQuickEditProduct(p)`
- [ ] Wire standard grid card `onClick` to `setQuickEditProduct(p)`
- [ ] Render `<ProductQuickEdit />` component at bottom of ProductsTab return, driven by `quickEditProduct` state
- [ ] Verify table view still uses inline expansion (no regression)
- [ ] check_for_errors
