---
title: Quick actions column on orders list
status: done
priority: high
type: feature
tags: [orders, templates, ux]
created_by: agent
created_at: 2026-04-26
position: 227
---

## Notes

Add a compact "Actions" column at the right edge of the orders table in `src/components/explore/OrdersTab.tsx` (and reflected in any column-config menu) so users can perform the three most common per-order actions without opening the row or detail page.

The three icon buttons, left to right:
1. **Mark complete** — checkmark icon. Calls existing `updateOrderStatus(order.id, "completed")` from `orderService.ts`. Optimistic update, toast on success/fail. Disabled (greyed) when status is already `completed`, `cancelled`, or `refunded`.
2. **Download invoice** — receipt icon with green check overlay. Opens the site's default invoice template render URL in a new tab: `/api/templates/{defaultInvoiceId}/render?format=pdf&store_id={storeId}&order_id={orderId}`. If no default is set, falls back to the first available custom invoice template, then the first sample. Shows a small toast linking to Templates page if none exist.
3. **Download pick slip** — clipboard icon. Same logic as invoice but for pick-slip type templates.

Visual style — match WooCommerce admin: small bordered icon buttons (24-28px square), grouped tightly, subtle border, hover lift, primary-color icons. Tooltip on each (`Mark complete`, `Print invoice`, `Print pick slip`).

Implementation details:
- Resolve default templates once at table mount via `listTemplates("invoice")` and `listTemplates("pickslip")` (already cached by react-query). Pick `is_default_for_type && client_id === current_client` first, fall back to first non-sample, then sample.
- Column should be sticky-right on wide screens so it stays visible during horizontal scroll.
- Column width compact: ~110px for three buttons + small gap.
- Hide the column on mobile (`hidden md:table-cell`).
- Mark-complete button shows a tiny spinner while the mutation is in flight; row stays at its current position.
- Activity log entry `order.quick_status_change` and `order.quick_invoice_print` / `order.quick_pickslip_print` for audit.

Edge cases:
- If no templates exist at all for the type → button is disabled with tooltip "No template available — visit Templates page".
- If user lacks permission to edit orders → mark-complete button hidden (reuse existing permission check).

## Checklist

- [ ] Add "Actions" column at the right edge of the orders table, sticky on wide screens, hidden on mobile.
- [ ] Mark-complete icon button (checkmark) that calls `updateOrderStatus` with `completed`, disabled for completed/cancelled/refunded orders, optimistic update with toast.
- [ ] Print invoice icon button that opens `/api/templates/{id}/render?...` in a new tab using the resolved default invoice template.
- [ ] Print pick-slip icon button using the resolved default pick-slip template, mirroring invoice behavior.
- [ ] Default template resolution: client-default → first user template → first sample → disabled state with helpful tooltip if none exist.
- [ ] Compact 24-28px bordered icon buttons grouped tightly, primary color, hover state, tooltips on each.
- [ ] Mark-complete shows inline spinner during mutation; row position unchanged.
- [ ] Activity log entries for quick status change and quick prints.
- [ ] Column toggle works in the existing Columns menu so power users can hide it.

## Acceptance

- A user viewing the orders list can complete an order, print its invoice, and print its pick slip with one click each, without opening the row.
- Buttons reflect order status correctly (completed orders cannot be re-completed) and template availability (disabled when none exists).
- Default template selected matches the one configured in Site Configuration → Default templates.