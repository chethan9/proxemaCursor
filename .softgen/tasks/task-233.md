---
title: Variable product variations save without option binding (storefront shows parent price)
status: done
priority: urgent
type: bug
tags: [products, variations, woocommerce, integration]
created_by: agent
created_at: 2026-04-26T22:00:00Z
position: 233
---

## Notes

**Confirmed root cause** (verified via WooCommerce admin — variation rows show "Any Color…" instead of a concrete option):

When a user types an attribute name in `src/components/product-edit/variants/AttributeEditor.tsx` and that name matches a pre-existing **global** Woo attribute (`pa_color`, etc.), the editor assigns the global attribute's ID to the form attribute (`AttributeEditor.tsx:14-22`, via `useWooAttributes`). User then freely types option strings like "blue", "Green", "Red" — but those are NOT registered as **terms** of the global attribute in Woo.

On save, we send to Woo:
- Parent: `{id: 234, name: "Color", options: ["blue", "Green", "Red"], variation: true}` — Woo accepts the options as strings
- Variation: `{id: 234, name: "Color", option: "blue"}` — **Woo cannot bind `"blue"` because it isn't a registered term of attribute #234** → variation is created with no attribute selection → "Any Color…" in admin

This causes the cascade:
1. All variations look identical to Woo (no option set) → effective duplicates
2. Storefront has nothing to differentiate them → falls back to parent price/stock for every variant
3. On reopen in our app, our `product_variations.attributes` JSONB is whatever Woo returned (often empty `[]` or default placeholders), so all rows hash to the same dedup key → "Duplicate attribute combinations detected at rows 2, 3" warning

Custom (non-global, `id: 0`) attributes work fine — Woo treats `option` strings literally for those.

**Fix strategy** (server-side, before the Woo POST):

In `src/pages/api/stores/[storeId]/products/create.ts` and `src/pages/api/stores/[storeId]/products/[productId].ts` (update endpoint), add a "term reconciliation" step:

1. Walk the parent `attributes` payload. For each entry where `id > 0` (global attribute), fetch its existing terms: `GET /wp-json/wc/v3/products/attributes/{id}/terms?per_page=100` (paginate if needed).
2. Diff `attribute.options` (parent) ∪ all `variation.attributes[].option` values used → registered term names. Case-insensitive match on `name` and `slug`.
3. For each missing term, `POST /wp-json/wc/v3/products/attributes/{id}/terms` with `{name: option}`. Capture the resulting term `slug`.
4. For each variation in the batch payload, normalize `attributes[].option` to the registered term **slug** (Woo accepts either name or slug, but slug is the canonical form and avoids casing/whitespace mismatch).
5. Then proceed with the existing `products/{wooId}/variations/batch` create call.

Custom attributes (`id == 0`) skip this entirely — they pass through as free-form text.

**Logging** (already added in last iteration): keep `[woo-variations-create]` / `[woo-variations-response]` console blocks. Add a `[woo-terms-reconcile]` block showing `{attributeId, existingTerms, missingTerms, createdTerms}` for diagnostics.

**Preserve existing behavior:**
- Bulk update flows that touch variations (`/api/cron/process-bulk-jobs.ts` — `assign_product_categories` etc.) don't need this fix; they don't create variations from scratch.
- `update.ts` flow that re-creates variations on save needs the same reconciliation.

## Checklist

- [ ] Server-side term reconciliation helper: build `reconcileAttributeTerms(creds, attributes, variations)` in `src/lib/woocommerce-auth.ts` or a new `src/lib/woo-terms.ts` that fetches existing terms per global attribute, creates missing terms, returns a mapping `{attributeId → {optionName → registeredSlug}}`.
- [ ] Wire reconciliation into `create.ts` for variable products before the variations batch POST. Replace each `variation.attributes[].option` with the canonical slug from the mapping.
- [ ] Wire same reconciliation into `[productId].ts` (update endpoint) for the variations sync block.
- [ ] Persist `tax_status`, `tax_class`, `sold_individually`, `virtual`, `downloadable` to DB columns from the Woo response (already done in last iteration — verify it shipped).
- [ ] Edit page load (`src/pages/sites/[id]/products/edit/[productId].tsx`) reads tax fields with `raw_data` fallback (already done — verify it shipped).
- [ ] Add `[woo-terms-reconcile]` console.log block with structured payload for QA.
- [ ] Reproduce with attribute "Color" and options "Red"/"Green"/"Blue" against a real Woo store. Verify Woo admin shows the variation rows with concrete options selected (not "Any Color…").
- [ ] Verify storefront: each variation shows its own price + stock, not parent fallback.
- [ ] Verify reopen: "Duplicate attribute combinations" warning is gone; each row's options column shows its option.

## Acceptance

- Creating a variable product with 3 color variations writes 3 distinct, fully-bound variations to Woo (admin shows specific options, not "Any …").
- Storefront product page shows per-variant price + stock once a variant is selected.
- Reopening the product in our editor shows variations with correct options and no false duplicate warning.