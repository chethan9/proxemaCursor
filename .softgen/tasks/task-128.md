---
title: Customer Orders tab upgrade with line items and summary
status: done
priority: high
type: feature
tags: [customers, orders, details]
created_by: agent
created_at: 2026-04-21T19:30:00Z
position: 128
---

## Notes

Current Orders tab on customer details page shows bare-minimum info (status, id, date, payment, total). Upgrade to surface product details, line items, and per-customer stats.

Files:
- `src/pages/sites/[id]/customers/[customerId].tsx` — Orders tab section
- `src/services/customerService.ts` — expand `fetchCustomerOrders` return shape
- Reference: `src/components/explore/OrderRowExpanded.tsx` for thumbnail strip + line items pattern, `src/pages/sites/[id]/orders/[orderId].tsx` for full breakdown styling

## Checklist

- [ ] Service: expand `fetchCustomerOrders` to return `line_items`, `shipping_lines`, `coupon_lines`, `shipping_total`, `discount_total`, `tax_total` from `raw_data`
- [ ] Summary strip above orders list: 5 tiles — Total orders, Completed, Cancelled, Total spent, AOV (compute from full customer orders, not paginated page)
- [ ] Status filter chips row: All / Completed / Processing / Pending / On-Hold / Cancelled / Refunded / Failed — counts per chip
- [ ] Optional date range picker (reuse existing DateRangeFilter if available)
- [ ] Enriched order card top line: status pill + `#orderId` + date + payment method + total (right-aligned)
- [ ] Product thumbnail strip: up to 5 line-item images with qty badges (overflow: `+N more`)
- [ ] Meta row: item count · shipping method · ship-to city/country · coupon code if used
- [ ] Entire card click → router.push(`/sites/[id]/orders/[orderId]`)
- [ ] Expand chevron (right): inline expands to show full line items (thumb, name, SKU, variation, `qty × price = subtotal`) + totals breakdown (subtotal, discount, shipping, tax, total)
- [ ] Infinite scroll or "Load more" button (10 per page)
- [ ] Empty state: icon + "No orders yet" + subtitle
- [ ] Pill style + spacing consistent with `docs/UI_REFERENCE.md`

## Acceptance

- Orders tab shows rich order summary with products, not just ids
- Filter chips and summary tiles update correctly
- Clicking a card goes to the order detail page
- Expand chevron shows full line-item breakdown inline