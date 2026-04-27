---
title: Variable product UX polish — price range, smart stock, quick edit
status: todo
priority: high
type: feature
tags: [products, variable, quick-edit, ui]
created_by: agent
created_at: 2026-04-27T11:30:00Z
position: 241
---

## Notes

Four related issues with how variable products surface across the app. They all share the same root: today the UI treats variable products like simple ones, which gives misleading info (single price when there are 6 variations at different prices, no-stock label when only the parent has no stock, editable price field that does nothing because variable parents don't carry price).

### 1. Show price range for variable products

In product cards (grid view + compact view + list rows), variable products currently show the parent's `regular_price` (often `0` or whatever the cheapest variation is). This is wrong — should show `min – max` if min ≠ max, or single price if all variations are the same. Affects:
- `src/components/explore/ProductsTab.tsx` — grid card price + compact card price + table row price column
- `src/components/explore/ProductRowExpanded.tsx` — same treatment in expanded panel header

**Source of min/max:** check `productService.fetchProducts` query — likely needs to either (a) read from a `variations` array on the row if synced, or (b) add `min_variation_price` + `max_variation_price` columns populated by the sync engine. Option (b) is faster at render time but needs sync engine update. Option (a) is fine if variations are already on the row.

If neither exists today: add `min_price` + `max_price` numeric columns to `products`, populate in `src/lib/sync-engine.ts` on variable-product sync (after variations are fetched), backfill via the existing initial-sync path. Then read these in render.

Format: when min === max → `KWD 44`. When min ≠ max → `KWD 44 – 89`. Currency stays from `store.currency`.

### 2. Disable price fields in Quick Edit for variable products

`src/components/explore/ProductQuickEdit.tsx` — the quick edit dialog currently shows Regular price + Sale price inputs for ALL products. For variable products these don't apply (variations carry the price). Disable both fields with a helper note: `"Set per-variation prices in the full editor"`. Stock fields stay enabled (parent stock_status still applies). Add a `Pencil → Edit variations` link that takes the user to the full editor's Variants tab.

### 3. Stock defaults to "in stock" for variations with no manual qty

In `src/components/product-edit/variants/VariationsTable.tsx` and `src/components/product-edit/variants/VariationEditDialog.tsx` — currently when a variation has no quantity entered AND `manage_stock` is off, the row often shows as "out of stock" or empty. Per Woo behavior: if no stock managed and no manual override, the variation should be treated as `instock` (Woo's default).

Logic change in the variations editor only (not parent product):
- New variation default `stock_status = "instock"` (already the case based on `utils.ts` — verify).
- When user does NOT enable `manage_stock` AND has not explicitly set status to `outofstock` → keep `instock`. Today some flow may flip to `outofstock` when qty is `0` or empty. Suppress that flip if `manage_stock = false`.
- The Stock dropdown stays editable so user can manually choose `outofstock`. Just don't auto-flip on empty/zero qty.

Affected handlers:
- `setQty` in `VariationEditDialog.tsx` — if `raw === ""`, do not change stock_status. If a numeric is entered AND `manage_stock` becomes true, then qty=0 → `outofstock`, else `instock`.
- The inline qty input in `VariationsTable.tsx` — same rule.

### 4. Quick Edit dialog UI polish — fix the "Edit full product" link

Looking at `ProductQuickEdit.tsx` footer: the "Edit full product" link is a tiny text link with a pencil icon, easy to miss. Promote it to a proper outline button with the pencil icon, sized like Cancel/Save. Move it to the LEFT side of the footer; keep Cancel + Save on the right. Visual weight should make it clear this is a real action, not just a hint.

Also tighten the field stack: tighten label color (current `text-muted-foreground` is fine), add a subtle divider above the stock card section so the card grouping is more visible.

## Checklist

- [ ] Determine source of min/max variation price — either expose existing data or add `min_price` + `max_price` columns (numeric) to `products` table and populate during variable-product sync in `src/lib/sync-engine.ts`. Backfill once via a one-off SQL refresh on the next scheduled sync.
- [ ] Update price render in `ProductsTab.tsx` (grid card + compact card + table cell) and `ProductRowExpanded.tsx` to show `min – max` for variable products when min ≠ max, single price otherwise. Use existing `formatCurrency` helper.
- [ ] In `ProductQuickEdit.tsx`: disable Regular price + Sale price inputs when product type is `variable`, replace with a small note `"Set prices per variation in the full editor"`. Keep stock fields enabled.
- [ ] In `ProductQuickEdit.tsx` footer: promote "Edit full product" from tiny link to proper outline button, left side of footer. Cancel + Save stay on the right. Add a subtle border-top divider above the stock-management card section.
- [ ] In `VariationEditDialog.tsx` `setQty`: when input is empty don't change stock_status; only flip to `outofstock` when manage_stock is true AND a numeric 0 is entered.
- [ ] In `VariationsTable.tsx` inline qty input: apply the same non-flip rule. Also bump the default stock_status for new variations to `instock` (verify via `utils.ts`).

## Acceptance

- A variable product with variations priced 44, 47, 60 shows `KWD 44 – 60` in grid + list views, not a single price.
- Opening Quick Edit on a variable product shows Regular/Sale price inputs greyed out with a helper hint, and a prominent "Edit full product" button on the bottom-left of the dialog.
- A new variation with no quantity entered and Manage Stock off remains "In stock" — does not auto-flip to "Out of stock".
- The variation editor still lets the user manually pick Out of Stock or On Backorder from the dropdown.