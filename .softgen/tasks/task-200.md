---
title: Skeleton shimmers for detail pages
status: todo
priority: high
type: feature
tags: [ux, loading, polish]
created_by: agent
created_at: 2026-04-25T22:00:00Z
position: 200
---

## Notes

Refetch overlay for list tables (Products, Orders, Customers, Categories, Tags) is shipped — `TableLoadingOverlay` component shows a centered "Updating…" pill during filter/sort/pagination refetches with old data still visible underneath.

Remaining work: replace plain spinners with **layout-matching skeleton shimmers** on detail/edit pages that currently show a blank screen or generic spinner during first load.

## Checklist

- [ ] Product edit page (`src/pages/sites/[id]/products/edit/[productId].tsx`) — shimmer matching: image gallery area, basic info fields (name/SKU/status), tab strip, pricing card, inventory card
- [ ] Order detail page (`src/pages/sites/[id]/orders/[orderId].tsx`) — shimmer matching: header (order number/status badges/customer), line items table rows, customer panel (avatar + contact), totals card
- [ ] Customer detail/edit page (`src/pages/sites/[id]/customers/[customerId].tsx`) — shimmer matching: avatar + name header, contact fields grid, addresses card, recent orders list
- [ ] Verify list-page shimmers (Products table+grid, Orders, Customers, Categories, Tags) match final row/card shape — refine any that look generic

## Acceptance

- Opening Product/Order/Customer edit pages cold shows a skeleton mirroring the final layout — no blank screen, no plain centered spinner
- Skeleton shape transitions smoothly into real data without layout shift