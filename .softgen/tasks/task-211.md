---
title: Variations grouping + enhanced bulk actions
status: todo
priority: high
type: feature
tags: [product-edit, ux]
created_by: agent
created_at: 2026-04-26T02:51:30Z
position: 211
---

## Notes

Upgrade `src/components/product-edit/variants/VariationsTable.tsx` to a Shopify-style grouped variations view.

**Grouping:**
- Add a "Group by" select above the table — options = each attribute name marked `variation: true` (e.g. Size, Color, Material) + "None".
- Default = first variation attribute.
- When grouped: render parent rows per group value (e.g. "small — 2 variants ▾", "big — 2 variants ▾") with collapsible child rows showing each combination underneath. Group rows show aggregate price/stock when consistent, or "—" when mixed.
- "None" mode = current flat table.

**Enhanced bulk actions:**
Current menu has: regular price, sale price, stock qty, enable/disable. Expand to include:
- Edit prices (regular)
- Edit sale prices
- Edit quantities
- Edit SKUs (bulk SKU template, e.g. `{base}-{attr}`)
- Edit weights
- Edit dimensions
- Add images (open `ImagePickerDialog` to bulk-assign)
- Enable / Disable all
- **Delete variants** (with confirmation)

**Selection UX:**
- Header checkbox = select all visible (respect collapsed groups).
- Group row checkbox = select all variants inside that group.
- Show "N selected" + "..." menu trigger like reference image.

**Preserve:** Existing per-row inline editing, error highlights for missing prices, the `applyBulk(patch, onlySelected, selectedKeys)` callback contract — extend rather than replace.

## Checklist

- [ ] Add "Group by" selector with attribute options + "None"
- [ ] Render collapsible parent rows per group value with aggregated summary
- [ ] Add child-row expand/collapse with chevron animation
- [ ] Group-row checkbox selects all child variants in that group
- [ ] Extend bulk actions menu: prices, sale prices, qty, SKUs, weights, dimensions, images, enable/disable, delete
- [ ] Bulk delete sends ids to `deletedVariationIds` (existing form field) and removes from `variations`
- [ ] Bulk image picker uses `ImagePickerDialog` and assigns to selected variants

## Acceptance

- Variations can be grouped by any varying attribute and collapsed/expanded.
- Bulk actions cover prices, SKUs, qty, weights, dimensions, images, enable/disable, delete.
- Selecting a group row selects all variants inside it.
