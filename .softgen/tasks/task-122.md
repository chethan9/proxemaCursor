---
title: Order details page
status: todo
priority: high
type: feature
tags: [orders, details, navigation]
created_by: agent
created_at: 2026-04-21T19:00:00Z
position: 122
---

## Notes

Build a dedicated order details page for each order with richer information than the expandable row. Inspired by the reference screenshot provided: `uploads/image_87979b3e-2d9b-4687-b8c2-361a120cc939.png`.

Route: `/sites/[id]/orders/[orderId]` (fetch from `orders` table by `id`).

Data source: existing `orders` table row (all data already available — `billing`, `shipping`, `line_items`, `shipping_lines`, `coupon_lines`, `fee_lines`, `date_created/paid/completed`, `payment_method_title`, `customer_note`, `raw_data.customer_ip_address`, `meta_data`). Use `getStore` for store context. No new DB tables needed for v1.

Order notes: pull from `raw_data.order_notes` if present; otherwise show "No notes yet". Add-note UI can be a stub that POSTs through a new `src/pages/api/stores/[storeId]/orders/[orderId]/notes.ts` endpoint writing via Woo REST (v1 can be placeholder that shows toast "Saved locally" until Woo notes endpoint is wired).

In the expanded order row (`src/components/explore/OrderRowExpanded.tsx` Actions column), add a new primary button labeled "Open order details" that links to the new page.

Use existing SiteLayout wrapper, keep design tokens consistent with the rest of the app (cards, borders, subtle badges — not the orange/amber from the reference screenshot — keep it neutral/brand).

## Checklist

- [ ] New order details page with back button to `/sites/[id]/orders`, breadcrumb "Orders / Order Details", order number headline (#7111), store-currency status badge on the right
- [ ] Status stepper strip: Order Placed / Processing / Completed (or Failed / Refunded / Cancelled branch) — each step shows label, date stamp, and check/empty state; current status highlighted
- [ ] Customer details card: name, email (mailto), phone (tel), customer IP from `raw_data.customer_ip_address`
- [ ] Address card: shipping address block + billing address block side by side, each with full lines (address_1/2, city/state/postcode, country, phone, email)
- [ ] Order details card: placed on, payment method + transaction id, paid on, last updated, customer note (if any)
- [ ] Items ordered table: image thumb, name, SKU, variation/attributes (size/color from meta_data), qty, unit price, line total — matches reference layout
- [ ] Totals block under items: subtotal, coupon discount with code chip, shipping method + cost, tax, grand total with currency
- [ ] Right sidebar — Actions card: Email invoice to customer, View customer (links to explore/customers when available else disabled), Resend order notification, Open in WP admin (external)
- [ ] Right sidebar — Order Notes card: list existing notes (from `raw_data.order_notes`) with timestamp, plus "Add note" textarea with Add button (wire to new API route, success = toast + append to list)
- [ ] Right sidebar — Status change section: quick buttons to change status (processing / on-hold / completed / cancelled / refunded / failed) — reuse logic from `OrderRowExpanded`
- [ ] Add "Open order details" button to `OrderRowExpanded` Actions column, links to `/sites/[id]/orders/[orderId]`
- [ ] Loading skeleton while fetching, 404 state if order not found, redirect to orders list if store not found
- [ ] Mobile responsive: sidebar stacks below main content on small screens

## Acceptance

- Clicking "Open order details" on an expanded order row navigates to the new page and shows all the same data plus customer IP, full addresses, order notes, and status stepper
- Changing status from the details page sidebar updates the order and reflects on the orders list
- Adding a note appends it to the notes list and persists (or shows clear "not yet implemented" if Woo endpoint not wired)