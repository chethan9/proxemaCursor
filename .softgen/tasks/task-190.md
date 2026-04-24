---
title: Order & customer history activity display
status: done
priority: high
type: bug
tags: [orders, customers, activity]
created_by: agent
created_at: 2026-04-24
position: 190
---

## Notes
**Bug Px-47.** The History tab on the Order Details page is empty even after order updates (status changes, refunds, etc.). Same behavior on the Customer Details → History page.

`EntityHistory` component exists (`src/components/EntityHistory.tsx`) and the `activity_log` table is populated for some actions, but the order details page does not mount EntityHistory — the History panel is an unwired placeholder. Customer details likely has the same gap.

Separate concern: even when EntityHistory is mounted, we need to confirm that semantic events for orders (status change, refund, fulfillment) are actually written to `activity_log` — the webhook handler and order-update endpoints may skip them.

Affected files: `src/pages/sites/[id]/orders/[orderId].tsx`, `src/pages/sites/[id]/customers/[customerId].tsx`, `src/components/EntityHistory.tsx` (verify it accepts `entityType` + `entityId` + `storeId` props), `src/pages/api/webhooks/incoming/[storeId].ts`, `src/pages/api/stores/[storeId]/orders/[orderId].ts`.

## Checklist
- [ ] Mount `EntityHistory` in the Order Details History panel, passing `entityType="order"`, `entityId=order.id`, `storeId`
- [ ] Mount `EntityHistory` in the Customer Details History panel, passing `entityType="customer"`, `entityId=customer.id`, `storeId`
- [ ] Verify activity_log entries are written on: order status change, order refund, order note added, customer edit (billing/shipping), customer create, customer delete
- [ ] If missing, add inserts in the corresponding API handlers + webhook handler
- [ ] Empty state inside EntityHistory when no events yet ("No activity recorded yet")
- [ ] Confirm RLS on activity_log permits reads for the current store's client scope

## Acceptance
- Change an order status → History tab shows the event within a few seconds
- Edit a customer address → Customer History shows the diff event
- New customer / deleted customer also recorded in the customer's activity