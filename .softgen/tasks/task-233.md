---
title: Variable product variations corrupt on save (storefront shows parent price, editor shows duplicate-combo warning on reopen)
status: todo
priority: urgent
type: bug
tags: [variations, products, woo-sync, data-integrity]
created_by: agent
created_at: 2026-04-26
position: 233
---

## Notes

User reports two symptoms that share one root cause:

1. **Editor**: Reopening a variable product (e.g. SKU `7777` with Color: blue/green/red, all priced 33) shows "Duplicate attribute combinations detected at rows 2, 3." The SKUs `7777-RED`, `7777-GREEN`, `7777-BLUE` look distinct in the table, but the duplicate-detector compares `attributes` arrays, not SKUs.
2. **Storefront**: Variable product on the live website displays the parent base price (0.00 / empty) and parent stock for all variations instead of each variation's own price + stock.

### Root cause hypothesis

When the editor submits a variable product, each variation in `form.variations` carries an `attributes` array like `[{name: "Color", option: "Red"}]`. Suspect a corruption in the path between the form and the WooCommerce variations batch endpoint:

- `src/services/productValidation.ts::buildWooPayload` → `payload.variations[i].attributes = v.attributes` — should be unique per row.
- `src/pages/api/stores/[storeId]/products/create.ts` lines ~190–215 — strips variations from parent payload, then sends `products/{wooId}/variations/batch` with the `create:` array. The mapping there builds the row from `v` (form variation), but **does it preserve `v.attributes` correctly?** Confirm by logging the exact array sent to Woo.

If Woo receives all 3 variations with the same `attributes` array (or empty), it creates 3 rows but they all map to the same attribute combo → effectively one variation → storefront falls back to parent price. Our DB then stores 3 rows with identical `attributes`, triggering the duplicate-combo warning on reopen.

Secondary suspect: parent `attributes` array lacks `variation: true` flag for the Color attribute, so Woo doesn't treat any options as variation-eligible and ignores the variation rows' attribute selections.

### Investigation steps

- Open `src/pages/api/stores/[storeId]/products/create.ts` and add a `console.log("[woo-variations-payload]", JSON.stringify(createPayload, null, 2))` right before the `wooRequest(..., "products/${wooId}/variations/batch", { create: createPayload })` call. Have the user create a variable product and capture the server log.
- Inspect the parent `attributes` payload sent to Woo — confirm `variation: true` is set on the Color attribute. The form has `attributes[i].variation` boolean; verify `buildWooPayload` includes it.
- Inspect each `createPayload[i].attributes` — must be `[{name: "Color", option: "Red"}]` for row 0, `{... "Green"}` for row 1, etc. If all empty or all identical, the bug is in the form→payload mapping.
- After save, query `product_variations` table for the test product and confirm each row's `attributes` JSONB column holds the unique option.

## Checklist

- [ ] Add structured logging in `create.ts` variations block: log the full `createPayload` array sent to Woo and the `batchRes.create` response. Log to server console with a prefix like `[woo-variations-create]`. User will reproduce and share logs.
- [ ] Verify `buildWooPayload` in `productValidation.ts` propagates `variation: true` on parent attributes when the user has ticked "Use for variations" in the editor. If lost, fix the mapping.
- [ ] Verify each variation's `attributes` array reaches Woo with the unique option string (`"Red"`, `"Green"`, `"Blue"`). If form state has them but payload drops them, fix the build step.
- [ ] After Woo responds, confirm our DB upsert in `create.ts` writes the unique attributes JSONB per variation row. If Woo sends them back, the upsert should preserve them — verify with a SELECT after a test create.
- [ ] Same audit for the update path: `src/pages/api/stores/[storeId]/products/[productId].ts` variations block. Saving an existing variable product shouldn't flatten the attributes either.
- [ ] On the storefront side: a properly-configured variable product in Woo will automatically show per-variation price/stock when the customer picks an option. No frontend code change needed if the variations are saved correctly. Confirm by visiting the live product page after the fix and checking the variant dropdown updates the displayed price.
- [ ] On reopen, "Duplicate attribute combinations detected" warning should disappear because each row now has a unique `attributes` array.

## Acceptance

- Create a variable product with 3 color variations at different prices. Live website shows the variant-specific price + stock when each color is selected (not the parent price for all).
- Reopen the same product in the editor. Variations tab shows 3 rows with their distinct attribute options. No duplicate-combo warning.
- Database `product_variations` rows for the product each have a unique `attributes` JSONB.