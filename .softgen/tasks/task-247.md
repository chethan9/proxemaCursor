---
title: Variant SKU validation + tab checkmark fixes
status: todo
priority: high
type: bug
tags: [products, validation, ui]
created_by: agent
created_at: 2026-04-27T22:30:00Z
position: 247
---

## Notes

Two issues in product editor:

**1. Duplicate SKU within product (variations) is wrongly blocked.**
WooCommerce allows multiple variations of the same product to share a SKU (e.g., size variants of the same shirt all using SKU `1023`). Our validation rejects this with "Variation N: duplicate SKU within product" — that's stricter than Woo itself. Remove the within-product duplicate check. KEEP the cross-product check (a SKU used by a different product/variation must still be flagged), since that's a real conflict Woo enforces.

Files:
- `src/pages/api/stores/[storeId]/products/create.ts` — strip the within-product duplicate loop, keep wpSkuMap cross-product check
- `src/pages/api/stores/[storeId]/products/[productId].ts` — same; cross-product check should exclude variations belonging to the product being updated (already correct, just remove the within-product duplicate detection)

**2. Tab checkmarks always show even when user hasn't filled the tab.**
In `AdvancedShell.tsx`, the green check next to each tab uses `canAdvance(tabKey)`. Currently `canAdvance` returns `true` for `inventory` and `variants` unconditionally, so they show checked from the first render. User wants checkmark only when the tab's actual requirements are met.

Per-tab "completed" rules:
- **Basics**: `form.name.trim().length > 0`
- **Inventory**: for `simple` type → `regular_price` is set (non-empty, parseable as number); for `variable` type → always `false` (variants own pricing instead, this tab is just shipping/stock toggles)
- **Variants** (only relevant for `variable` type): at least 1 variation exists AND every variation has a `regular_price`

Files:
- `src/pages/sites/[id]/products/new.tsx` — replace `canAdvance` with the rules above
- `src/pages/sites/[id]/products/edit/[productId].tsx` — same rules
- `src/components/product-edit/AdvancedShell.tsx` — no logic change needed; it already calls `canAdvance(step.key)` to decide check rendering. Confirm the check icon only renders when `canAdvance` returns true (it does).

## Checklist

- [ ] Remove within-product duplicate SKU validation in `create.ts` (keep cross-product wpSkuMap check)
- [ ] Remove within-product duplicate SKU validation in `[productId].ts` (keep cross-product wpSkuMap check, which already excludes self)
- [ ] Replace `canAdvance` in `new.tsx` with per-tab completion rules: basics=name filled, inventory=price set for simple (false for variable), variants=all variations priced
- [ ] Replace `canAdvance` in `edit/[productId].tsx` with the same per-tab rules
- [ ] Verify check icon visually disappears on a fresh add-product page until each tab's requirements are met

## Acceptance

- Saving a variable product with multiple variations sharing the same SKU succeeds (matches Woo behavior)
- Saving a variation with a SKU that belongs to a *different* product still fails with a clear message
- On a brand-new "Add product" page, no tab shows a green check until its specific requirements are filled