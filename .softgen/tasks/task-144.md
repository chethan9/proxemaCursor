---
title: Quick Edit manage_stock flag persistence
status: todo
priority: high
type: bug
tags: [products, quick-edit]
created_by: agent
created_at: 2026-04-22T15:55:00Z
position: 144
---

## Notes
Bug report Px-23. Verified in `src/components/explore/ProductQuickEdit.tsx`: the `save()` function builds `updates` with price/status/stock_status and, only if `manageStock` is true, sets `stock_quantity`. It never sends `manage_stock: true/false`. Result: toggling Manage Stock on + entering a qty → Woo keeps `manage_stock=false` → qty is ignored → reopen shows no manage.

Also the UI layer: after save, product widget in the list doesn't show the managed quantity because the stale/unflagged row has `manage_stock=false`. This is downstream of the same fix — once the flag persists, the widget can read it.

## Checklist
- [ ] In `ProductQuickEdit.tsx` `save()`, always include `manage_stock: manageStock` in the updates payload
- [ ] When `manageStock` is false, explicitly send `stock_quantity: null` so Woo clears any prior quantity
- [ ] Confirm `PUT /api/stores/[storeId]/products/[productId]` forwards `manage_stock` and `stock_quantity` to the Woo client (and writes them to the DB row's `raw_data.manage_stock` + top-level `stock_quantity` column)
- [ ] In the product widget (grid + table views in `ProductsTab.tsx`), when `raw_data.manage_stock === true` AND `stock_quantity != null`, display the exact number; otherwise fall back to the textual stock status
- [ ] Reopen Quick Edit after save shows the Manage Stock checkbox checked and the saved quantity pre-filled

## Acceptance
- Enable Manage Stock + set qty 27 + save → reload → widget shows "Stock: 27"
- Reopen Quick Edit on same product → checkbox is on, field shows 27
- Toggle Manage Stock off + save → widget reverts to stock-status text, reopen shows checkbox off
