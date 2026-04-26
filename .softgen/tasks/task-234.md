---
title: Tax status / tax class resets to default when reopening product editor
status: todo
priority: high
type: bug
tags: [products, editor, tax, load-fidelity]
created_by: agent
created_at: 2026-04-26
position: 234
---

## Notes

User reports: a product saved with **no tax** (tax_status = "none") shows up in the editor on reopen with tax enabled (tax_status = "taxable", the form default).

### Where it breaks

`src/pages/sites/[id]/products/edit/[productId].tsx` — load mapping uses:

```ts
tax_status: ((p.tax_status as ProductFormState["tax_status"]) || "taxable"),
tax_class: (p.tax_class as string) || "",
```

Two issues:
1. The `||` fallback to `"taxable"` masks a stored `"none"` value if the DB column happens to be null/empty (which it might be for older rows or rows where the column doesn't exist).
2. If the `products` table doesn't have a `tax_status` column at all (similar to the `manage_stock` schema drift bug from the previous fix), `p.tax_status` is `undefined` and the form silently falls back to "taxable".

The truth lives in `raw_data` (the full Woo response stored as JSONB). Editor should read column-level value first, fall back to `raw_data.tax_status` / `raw_data.tax_class`, and only default to "taxable" when both are absent.

### Cross-check

- Run on dev DB: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name IN ('tax_status','tax_class');` to confirm whether the columns exist. If they don't, add them via migration AND fix the load path.
- Read `src/pages/api/stores/[storeId]/products/[productId].ts` update flow — confirm `tax_status` and `tax_class` are written to both the column (if it exists) and `raw_data`.

## Checklist

- [ ] Verify whether `products.tax_status` and `products.tax_class` columns exist on the schema. If missing, add them: `ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tax_status text; ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tax_class text;` then `NOTIFY pgrst, 'reload schema';`. (User mirrors to live DB.)
- [ ] Update the load mapping in `edit/[productId].tsx` so `tax_status` reads column → `raw_data.tax_status` → default `"taxable"`. Same for `tax_class`. Replace the `|| "taxable"` short-circuit with explicit `?? raw.tax_status ?? "taxable"` so a stored `"none"` value isn't lost.
- [ ] Verify the update endpoint persists `tax_status` and `tax_class` into the column on save (not just `raw_data`). Open `src/pages/api/stores/[storeId]/products/[productId].ts` `updatePayload` block — add the two fields if missing. Same for the create endpoint `buildProductInsertRow` in `create.ts`.
- [ ] Test: create a product with tax_status = "none". Reload the editor. Tax toggle should show "No tax" (or whatever UI represents none). Switch to taxable, save, reload — should show taxable.

## Acceptance

- Saving a product with tax disabled, closing the editor, and reopening shows the tax field in the same disabled state.
- Same for tax class — selecting a non-default class persists across reload.