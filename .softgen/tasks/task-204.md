---
title: Customers explorer polish + segmented stock filter
status: in_progress
priority: high
type: feature
tags: [ui, ux, polish]
created_by: agent
created_at: 2026-04-26T00:05:00Z
position: 204
---

## Notes

Two related improvements:

1. Apply the same explorer polish (TopProgressBar + search spinner/⌘K + arrow-key pagination + soft data dim) to the customers list page so it matches Products/Orders/Taxonomy.

2. Replace the two-toggle stock filter on Products (Exclude out of stock / Out of stock only) with a single segmented control `All | In Stock | Out of Stock` to save horizontal space and make the filter mutually-exclusive by design.

## Checklist

- [x] Customers page: TopProgressBar at top of card, search 200ms debounce, ⌘K kbd hint + spinner, pagination disabled on isFetching, soft dim on refetch
- [x] Customers page: arrow keys ←/→ navigate pagination via useExplorerKeyboard
- [ ] Products page: replace `excludeOutOfStock` + `outOfStockOnly` switches with segmented `stockFilter: "all" | "in_stock" | "out_of_stock"` control
- [ ] Products data hook continues to filter correctly based on new value
- [ ] Remove now-unused state + clear-filter logic

## Acceptance

- Customers page behaves identically to Products/Orders for keyboard + visual feedback
- Products toolbar shows one segmented filter (3 buttons) instead of two switches; chosen segment is visually active; one-click switch between modes