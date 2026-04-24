---
title: Product price & quantity validation
status: todo
priority: medium
type: bug
tags: [product, validation]
created_by: agent
created_at: 2026-04-24
position: 187
---

## Notes
**Bugs Px-49 and Px-52.** Price and quantity fields accept invalid input:

- Px-49 (Quick Edit): negative values accepted for Regular Price, Sale Price, Stock Quantity
- Px-52 (Add Product — Basic & Advanced): 0 accepted as regular/sale price (unless Free Product is selected), 0 accepted as stock quantity

Rule: negatives rejected everywhere. Zero for price is only valid when "Free Product" is selected. Zero for stock quantity is valid (means 0 in stock) but should still show a validation hint — the real rule is "not negative".

Affected files: `src/components/explore/ProductQuickEdit.tsx`, `src/components/product-edit/BasicEditor.tsx`, `src/components/product-edit/tabs/PricingTaxTab.tsx`, `src/components/product-edit/tabs/InventoryShippingTab.tsx`.

## Checklist
- [ ] Reject negative values on all price and quantity inputs (clamp to 0 on blur, prevent typing minus)
- [ ] Block publish if Regular Price = 0 or empty and Free Product is not selected; show inline error "Price must be greater than 0, or enable Free Product"
- [ ] Block publish if Sale Price ≥ Regular Price when Regular > 0; show inline error
- [ ] Stock qty: allow 0 but reject negatives; input `min="0"` + onBlur clamp
- [ ] Quick Edit: apply same rules before PUT; disable Save until valid
- [ ] Apply to Basic and Advanced editors
- [ ] Verify error states do not prevent saving as Draft

## Acceptance
- Typing -5 anywhere gets clamped to 0 on blur; cannot be submitted
- Saving Regular Price = 0 without Free Product is blocked with clear inline message
- Saving 0 in stock qty is allowed (out-of-stock scenario)