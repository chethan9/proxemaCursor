---
title: Auto-refresh customer record when order is marked completed
status: todo
priority: medium
type: feature
tags: [orders, customers, sync]
created_by: agent
created_at: 2026-04-27T10:30:00Z
position: 240
---

## Notes

When a WooCommerce order is created by a guest, Woo often creates/links a customer account on order completion (depending on the store's "create account on order" or manual conversion settings). Today our customer mirror only catches up on the next scheduled sync (5–30+ min later), so the order detail page shows guest info / stale customer for a long time after the operator marks it completed.

**Fix:** Right after a successful order status change to `completed`, also pull the order's `customer_id` from Woo and upsert it into our `customers` table. Synchronous, server-side, atomic with the order update.

### Where to wire this

Single-order updates flow through the order PATCH endpoint at `src/pages/api/stores/[storeId]/orders/[orderId].ts`. The endpoint already authenticates against Woo and updates our mirror. Add a post-success hook there.

Bulk status updates flow through `src/pages/api/cron/process-bulk-jobs.ts` (the `update_order_status` job type). Same hook needs to fire there per item that succeeded.

### Logic

After the Woo order update returns success and our mirror upsert completes:

1. Read `customer_id` from the Woo response (or our updated row). If `0` or null → skip (true guest order, Woo didn't create an account).
2. Skip if the new status is NOT `completed` (only fire on the conversion moment).
3. Check our `customers` table for that `(store_id, woo_id=customer_id)` row:
   - If row exists AND `synced_at` is within the last 5 minutes → skip (already fresh).
   - Otherwise → fetch `/wp-json/wc/v3/customers/{customer_id}` from Woo using the existing `woo-client.ts` helpers, then upsert into `customers` (same shape the regular sync uses).
4. Wrap the fetch+upsert in try/catch; failures must NOT fail the order update — log and move on. The eventual scheduled sync will pick it up.

### Reusable helper

Extract a small server-side helper `refreshCustomerForOrder(storeId, customerId)` in `src/services/customerService.ts` (or a new `src/lib/customer-refresh.ts` if cleaner) so both the single-order endpoint and the bulk-jobs cron call the same code. The helper itself handles the freshness check and the upsert.

### Don't break

- Orders for true guests (`customer_id = 0`): no-op, no error.
- Orders whose customer was deleted in Woo: 404 from Woo → log, no-op.
- Don't re-trigger if status was already `completed` and is being saved with the same status (idempotent edits).

## Checklist

- [ ] Add `refreshCustomerForOrder(storeId, customerId)` helper that fetches `/wc/v3/customers/{id}` via the existing Woo client and upserts into `customers`, with a 5-minute freshness skip.
- [ ] Call the helper from `src/pages/api/stores/[storeId]/orders/[orderId].ts` after a successful order update where `new_status === 'completed'` and `customer_id > 0`. Wrap in try/catch.
- [ ] Call the same helper from `src/pages/api/cron/process-bulk-jobs.ts` for each order in the `update_order_status` worker that succeeds with the target status `completed`. Wrap in try/catch per-item.
- [ ] Verify the customer detail and orders pages on the same site reflect the refreshed customer name/email/phone within ~2s of marking the order completed (existing react-query invalidation already covers customers if we touch the table).

## Acceptance

- A guest order with `customer_id = 0` marked completed → no Woo customer call attempted, no errors.
- An order with `customer_id = 12345` marked completed → within 1–2 seconds the customer row in our DB shows fresh `synced_at`, and the order detail page customer block reflects current Woo data instead of stale/guest info.
- A bulk "mark completed" job over 50 orders triggers up to 50 customer refreshes (skipping duplicates within 5 min); none of them fail the order update job if Woo customer fetch errors.