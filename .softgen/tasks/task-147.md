---
title: Product editor UX enhancements (auto-SKU, tag picker, alignment)
status: todo
priority: low
type: feature
tags: [products, ux]
created_by: agent
created_at: 2026-04-22T15:55:00Z
position: 147
---

## Notes
Bundle of the three enhancement-class items from the bug report. Treat as low priority — land after the Px-bug tasks.

- **Px-13 (auto-generate SKU in Basic mode)**: `InventoryShippingTab` (Advanced) already has an "Auto SKU" button. Port the same pattern to the Basic editor's SKU field.
- **Px-25 (column alignment Category/Tag list)**: In the Category List and Tag List (rendered via `TaxonomyTab.tsx` or `SitesTable.tsx` — verify actual file), the "Product count" label is right-aligned while its number cell is also right-aligned (good for numbers), but the "Description" label is left-aligned and content left-aligned. Fix: align each column header to match its content alignment (numbers right, text left) consistently.
- **Px-27 (existing tags picker in Add Product)**: Currently `BasicEditor.tsx` tag input only accepts free-text new tags. Mirror the category popover pattern — show a searchable list of existing tags from `useWooTaxonomy(storeId, "tags")` with an option to create a new one if no match. Same change in `BasicInfoTab.tsx` (Advanced).

## Checklist
- [ ] Add an "Auto SKU" button next to the SKU input in `BasicEditor.tsx`, reusing the generator logic from `InventoryShippingTab.tsx` (3-letter prefix from name + 7-digit random)
- [ ] In `BasicEditor.tsx` tag input: replace the plain Input with a Popover + search pattern identical to the category picker; load tags via `useWooTaxonomy(storeId, "tags")`; allow "Create new tag" when the search string has no match
- [ ] Apply the same tag-picker upgrade to `BasicInfoTab.tsx` (Advanced)
- [ ] In the Category + Tag list tables, ensure header alignment matches cell alignment per column (numbers right, text left); verify in both Category module and Tag module

## Acceptance
- Basic mode SKU field has an Auto SKU button that fills a generated value
- Basic and Advanced tag fields show a searchable dropdown of existing tags with a "Create" fallback
- Category and Tag list tables have consistent header/cell alignment for every column
