---
title: Quick Edit manage_stock flag persistence
status: done
priority: high
type: bug
tags: [products, quick-edit]
created_by: agent
created_at: 2026-04-22T15:56:30Z
position: 144
---

## Notes
Bug Px-23. In `ProductQuickEdit.save()`, `manage_stock` is only sent when true, and even then only `stock_quantity` is included. Turning manage stock OFF never persists. Woo keeps the old flag → reopen shows the same state, widget shows stock status rather than quantity.

## Checklist
- [x] In `ProductQuickEdit.save()` always include `manage_stock: manageStock` in the update payload
- [x] When `manageStock` is false, send `stock_quantity: null` to clear any previous quantity
- [x] When `manageStock` is true, send parsed integer or null if empty

## Acceptance
- Enable Manage Stock + set qty → save → widget shows "N in stock", reopen shows checkbox on + qty populated
- Disable Manage Stock → save → widget reverts to stock-status text, reopen shows checkbox off
