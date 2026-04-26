---
title: Stray "0" below shipping in order expand widget
status: done
priority: high
type: bug
tags: [orders, explore, ui-bug]
created_by: agent
created_at: 2026-04-26T08:30:00Z
position: 213
---

## Notes
On the Explore → Orders page, when expanding an order row (component: `src/components/explore/OrderRowExpanded.tsx`), a bare `0` appears as its own line between the "Shipping" total row and the "Total" row in column 1's totals breakdown. Other order surfaces (e.g. order details page) do not show this. Reproduces on order with `woo_id=7264` (data: `total_tax: null`, `shipping_total: '8.50'`, `discount_total: '0.00'`, empty `coupon_lines`).

The current totals JSX in `OrderRowExpanded.tsx` (lines ~170–192) already uses `Number(...) > 0` guards, so on paper nothing should render between Shipping and Total. Investigate:

1. Hard-refresh the preview to rule out stale build (last related commit `2707ad6` "fix(order): prevent zero discount from rendering").
2. If still reproducing, add a temporary `console.log({ total_tax: order.total_tax, shipping_total: order.shipping_total, discount_total: order.discount_total, coupon_lines: order.coupon_lines, fee_lines: (order as any).fee_lines })` inside the component to see exact runtime values for the affected order.
3. Inspect rendered DOM in browser devtools — locate the text node containing `0` and trace the parent JSX. Likely culprits: a `{x && <JSX/>}` where `x` is the number `0`, or a stray render in the coupons/shipping_lines map (e.g. `{c.discount && <span>...</span>}` where `c.discount` is `0` numeric).
4. Harden all conditional renders in the file by wrapping with `Boolean(...)` or using `> 0` numeric checks consistently — including inside `coupons.map` and `shippingLines.map`.
5. Verify fix on the original order (woo_id 7264) and on a clean order — no stray `0` in totals.

## Checklist
- [ ] Reproduce on Explore → Orders expanded row for woo_id 7264
- [ ] Add diagnostic logging to confirm runtime values
- [ ] Identify the exact JSX expression rendering the bare `0`
- [ ] Patch with `Boolean()` wrap or explicit numeric guard
- [ ] Audit `coupons.map` and `shippingLines.map` for `{x && <JSX/>}` patterns where `x` could be numeric `0`
- [ ] Remove diagnostic logs after fix
- [ ] Verify on affected order + one clean order

## Acceptance
- Expanding any order row in Explore → Orders shows totals with no stray `0` between Shipping and Total.
- Orders with `discount_total = 0`, `total_tax = null`, and zero-discount coupons all render cleanly.
