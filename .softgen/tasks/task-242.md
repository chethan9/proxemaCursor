---
title: Default variation selector for variable products
status: done
priority: medium
type: feature
tags: [products, variations, woocommerce]
created_by: agent
created_at: 2026-04-27T15:00:00Z
position: 242
---

## Notes

WooCommerce supports `default_attributes` on variable products — the combination of attribute values that should be pre-selected when a customer lands on the product page. Our editor previously ignored this field. Added a star toggle on each variation row + checkbox in the edit dialog, with single source of truth in `form.default_attributes`. Hydrates from `raw_data.default_attributes` on load and round-trips on save.

## Checklist

- [x] Add `default_attributes` field to `ProductFormState` + `emptyProductForm`
- [x] Add `variationMatchesDefault` and `defaultAttributesFromVariation` helpers
- [x] Include `default_attributes` in `formToWooPayload` for variable products
- [x] Star icon column in `VariationsTable` with set/clear behavior + visual highlight
- [x] Checkbox toggle in `VariationEditDialog` footer
- [x] Auto-clear default when variation removed (single delete + bulk delete)
- [x] Hydrate from `raw_data.default_attributes` on edit page load

## Acceptance

- Clicking the star on a variation row marks it as default with primary highlight + "Default" pill
- Clicking the star again or another row clears/replaces the selection
- Saving sends `default_attributes` to Woo and persists across reload
- Deleting the default variation clears the selection