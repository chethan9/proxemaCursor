---
title: Product form validation (negative values + publish guards)
status: done
priority: high
type: bug
tags: [products, validation, ui]
created_by: agent
created_at: 2026-04-22T15:55:00Z
position: 141
---

## Notes
Bug report Px-09 + Px-14. Two related validation gaps in the product add/edit flow:

- **Px-09**: All numeric inputs (regular price, sale price, stock quantity, weight, dimensions) accept negative values. The spinner's down-arrow takes 0 to -0.01. Affects `BasicEditor.tsx`, `PricingTaxTab.tsx`, `InventoryShippingTab.tsx`, and `ProductQuickEdit.tsx`.
- **Px-14**: "Publish" button in `BasicEditor` is disabled only when name is empty. A product with only a name gets pushed to Woo as published. When `status === "publish"`, should require either `regular_price > 0` OR the "Free product" checkbox to be on. Do NOT add broader required-field checks — WooCommerce itself is permissive and users may intentionally publish sparse products from the Advanced editor; we only guard the Basic-mode Publish action.

Show inline validation message below the price block when publish is blocked, not a toast.

## Checklist
- [x] Add `min="0"` to every numeric price/stock/weight/dimension input in `BasicEditor.tsx`, `PricingTaxTab.tsx`, `InventoryShippingTab.tsx`, `ProductQuickEdit.tsx`, and `VariationEditDialog.tsx` (variants have the same fields)
- [x] On change of these inputs, clamp negative values to 0 (defensive — spinner arrows bypass `min` in some browsers)
- [x] In `BasicEditor.tsx`: disable Publish button when `status === "publish"` AND no price set AND free-product flag is off; show a muted inline hint ("Add a price or mark as free product to publish")
- [x] Verify submit path: `formToWooPayload` should never serialize negative numerics — added `floorNumStr` guard in `productEditService.ts`

## Acceptance
- Typing or spinning below 0 in any price/stock/weight field is prevented or clamped
- Clicking Publish on an empty-priced, non-free product in Basic mode is blocked with a clear inline message
- Advanced mode remains unrestricted (intentional)
