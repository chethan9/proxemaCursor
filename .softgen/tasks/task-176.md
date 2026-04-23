---
title: Add "Edit product" link in Quick Edit dialog
status: todo
priority: high
type: bug
tags: [products, ui]
created_by: agent
created_at: 2026-04-23T20:30:00Z
position: 176
---

## Notes

`src/components/explore/ProductQuickEdit.tsx` currently only shows Cancel + Save in the footer. User expected an **Edit product** button that takes them to the full editor at `/sites/{store_id}/products/edit/{id}` for deeper changes (description, images, variants, etc).

The dialog is shared by both grid sizes (compact list + large grid cards in `ProductsTab.tsx`), so one fix covers both views.

Use `next/link` with `href={`/sites/${product.store_id}/products/edit/${product.id}`}` — opens the existing edit page (`src/pages/sites/[id]/products/edit/[productId].tsx`). Place it in the footer on the left (before Cancel/Save on the right) as a secondary `variant="outline"` button with a pencil icon.

## Checklist

- [ ] Add "Edit product" outline button with pencil icon in the Quick Edit dialog footer, left-aligned
- [ ] Button links to the full product edit page using the product's store_id + id
- [ ] Clicking the link closes the dialog before navigating so state doesn't conflict
- [ ] Works identically whether the dialog was opened from compact list view or large grid view

## Acceptance

- Opening Quick Edit on any product (list or grid) shows an "Edit product" button in the footer
- Clicking it navigates to the full product editor page for that product