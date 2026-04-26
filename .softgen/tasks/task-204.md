---
title: Customers explorer polish + segmented stock filter
status: done
priority: high
type: feature
tags: [ui, ux, polish]
created_by: agent
created_at: 2026-04-26T00:05:00Z
position: 204
---

## Notes

Two related improvements:

1. Customers list page polished to match Products/Orders/Taxonomy (TopProgressBar + ⌘K + arrow nav + dim on refetch).

2. Two toggles `Exclude out of stock` + `Out of stock only` replaced with a single segmented `All stock | In stock | Out of stock` control — saves horizontal space, mutually-exclusive by design.

## Checklist

- [x] Customers page: TopProgressBar at top of card, search 200ms debounce, ⌘K kbd hint + spinner, pagination disabled on isFetching, soft dim on refetch
- [x] Customers page: arrow keys ←/→ navigate pagination via useExplorerKeyboard
- [x] Products page: replaced two switches with segmented `stockStatusFilter` control (All / In stock / Out of stock)
- [x] Existing data flow preserved (`stockStatusFilter` already drives the query); `excludeOutOfStock` reset to false when segment changes

## Acceptance

- Customers page behaves identically to Products/Orders for keyboard + visual feedback
- Products toolbar shows one segmented filter (3 buttons) instead of two switches; chosen segment is visually active; one-click switch between modes