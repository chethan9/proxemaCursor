---
title: Default variation selector (Woo `default_attributes`)
status: todo
priority: medium
type: feature
tags: [products, variable, woocommerce]
created_by: agent
created_at: 2026-04-27T11:35:00Z
position: 242
---

## Notes

WooCommerce supports a "default variation" concept — when a customer lands on a variable product page, one variation is pre-selected (size: M, color: black, etc.). This is stored on the parent product as `default_attributes` (an array of `{name, slug, option}` matching one of the variations). Today our editor doesn't expose this; merchants set it in WP admin and we sync it back but don't surface it.

### What to add

In the product edit page's Variants tab (`src/components/product-edit/tabs/VariantsTab.tsx` + `src/components/product-edit/variants/VariationsTable.tsx`):

1. **Per-row "Set as default" affordance** — a small star/pin icon next to each variation row. Click to set that variation as the default. Visual: filled star when this row is the default, empty star otherwise. Only one variation can be default at a time — clicking a new one auto-clears the previous.

2. **Visual default marker** — the default variation row gets a subtle highlight (left border in primary color or a "Default" badge in the options column).

3. **Persist as `default_attributes`** — when saving the product, derive the array from the marked variation's attributes and POST it on the parent product update. Format Woo expects:
```json
"default_attributes": [
  {"id": 1, "name": "Size", "option": "M"},
  {"id": 2, "name": "Color", "option": "Black"}
]
```
Only include attributes that are actually `variation: true`.

4. **Hydrate on load** — when fetching the product for edit, read `default_attributes` from the Woo response, find the matching variation, and mark it as default in local state.

### Affected files

- Product type / state: `src/services/productEditService.ts` — extend the product state shape to include `default_variation_key: string | null` (the local variation key, easier than tracking attribute combos).
- Hydration: in the same service, when loading variations from the server response, match `default_attributes` against each variation's attributes to find the default and set the field.
- UI: `src/components/product-edit/variants/VariationsTable.tsx` — add the star button + highlight. Add an `onSetDefault(idx)` callback prop.
- UI: `src/components/product-edit/variants/VariationEditDialog.tsx` — also add "Set as default for product" toggle in the dialog footer area.
- Save: `src/pages/api/stores/[storeId]/products/[productId].ts` and `create.ts` — when updating/creating a variable product, build `default_attributes` from the marked variation's attributes and include in the Woo PUT/POST body.

### Edge cases

- User marks a default variation, then deletes that variation → clear `default_variation_key`.
- User saves a variable product with no variations marked → omit `default_attributes` from payload (Woo will keep whatever's there; or we send empty array to clear).
- Single-attribute variable product → `default_attributes` has one entry. Multi-attribute → multiple entries.

## Checklist

- [ ] Extend product edit state in `src/services/productEditService.ts` with `default_variation_key: string | null`. Hydrate from `default_attributes` returned by the Woo fetch (match by attributes name + option pairs).
- [ ] In `VariationsTable.tsx` add a star icon column (or inline in the options cell) that toggles the default. Highlight the default row with a left primary-color border + small "Default" badge.
- [ ] In `VariationEditDialog.tsx` add a "Set as default for this product" checkbox (or toggle) in the footer area, syncing with the same state.
- [ ] On product save (both create and update API endpoints), derive `default_attributes` from the marked variation's attributes and include it in the Woo product PUT/POST body. Skip the field if no default is set.
- [ ] When the marked default variation is deleted, clear `default_variation_key` so the save doesn't reference a phantom variation.
- [ ] Verify after save + reload, the default variation is still shown as default in the editor.

## Acceptance

- On a variable product, clicking the star icon next to the "M" variation marks it as default. Saving + reloading the product shows the same star still set.
- The default variation row has a visible highlight (border or badge).
- Only one variation can be default at a time — clicking a new one moves the marker.
- Verifying on the WooCommerce frontend, the variable product's add-to-cart form pre-selects the marked variation on page load.