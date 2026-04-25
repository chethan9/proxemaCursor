---
title: Skeleton shimmers for detail pages
status: done
priority: high
type: feature
tags: [ui, polish, loading]
created_by: agent
created_at: 2026-04-25T20:00:00Z
position: 200
---

## Notes

Detail pages (product edit, order detail, customer detail) used a generic full-page spinner while loading. Replaced with shimmer skeletons that mirror the actual layout so users see the page structure immediately and content fades in cleanly without layout shift.

## Checklist

- [x] Product edit page (`src/pages/sites/[id]/products/edit/[productId].tsx`): skeleton mirrors header bar + image gallery card + basic info card + pricing card + sidebar (status panel + sections)
- [x] Order detail page (`src/pages/sites/[id]/orders/[orderId].tsx`): skeleton mirrors stepper card + 3-up info row + items table with rows + sidebar (actions, status, notes)
- [x] Customer detail page (`src/pages/sites/[id]/customers/[customerId].tsx`): skeleton mirrors header card + tabs + details grid + addresses (CustomerDetailSkeleton from `@/components/site/shared`)
- [x] All skeletons use `animate-in fade-in duration-200` so the transition into real content is smooth

## Acceptance

- Navigating to a product/order/customer detail page shows a layout-shaped shimmer, not a plain centered spinner
- Skeleton shape transitions smoothly into real data without layout shift