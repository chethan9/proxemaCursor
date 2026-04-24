---
title: Product Advanced section data retention & UX
status: todo
priority: high
type: bug
tags: [product, advanced-editor]
created_by: agent
created_at: 2026-04-24
position: 186
---

## Notes
Four related bugs in the Advanced product editor flow:

- **Px-41:** Brand name, product tags, shipping (weight, dimensions), and the "Limit per purchase to 1" flag do not persist after publish. Preview doesn't show stock/weight either.
- **Px-42:** Product status selector (Publish/Draft/Pending/Private) is missing from the Advanced editor — user must switch to Basic to change status.
- **Px-42-1:** Same — status cannot be edited in Advanced on existing products.
- **Px-43:** Required fields in Advanced → Basic Info are not marked with an asterisk; user only learns they're required when "Next Step" is blocked.

Affected files: `src/components/product-edit/AdvancedShell.tsx`, `src/components/product-edit/tabs/BasicInfoTab.tsx`, `src/components/product-edit/tabs/InventoryShippingTab.tsx`, `src/components/product-edit/LivePreviewCard.tsx`, `src/services/productEditService.ts` (ensure save payload carries brand, tags, weight, dimensions, sold_individually).

## Checklist
- [ ] Verify save payload includes brand, tags, weight, dimensions (length/width/height), and `sold_individually` (Limit per purchase) — add if missing
- [ ] Verify GET/load hydrates all those fields back into the Advanced form
- [ ] LivePreviewCard shows current stock quantity and weight from form state
- [ ] Add Status selector to Advanced shell (header or sidebar) — same options as Basic: Publish / Draft / Pending / Private
- [ ] Status selector works for both create and edit flows
- [ ] Mark required fields in Basic Info tab with red asterisk (*) next to label — name, regular price (unless free)
- [ ] Tab validation message remains as a fallback but asterisks appear up front

## Acceptance
- Publish an Advanced product with brand + 2 tags + weight + dimensions + Limit per purchase on → reopen in Edit Advanced → all values visible
- Status can be changed from within Advanced editor without switching tabs
- Required fields visibly marked with *