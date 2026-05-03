# Semantic grain

| Model | Grain | Notes |
|-------|-------|--------|
| `stg_orders` | One row per synced order | Mirrors `public.orders` + billing fields from JSON. |
| `stg_order_lines` | One row per `line_items[]` element | Exploded in SQL from JSON. |
| `stg_coupon_lines` | One row per `coupon_lines[]` element | |
| `stg_shipping_lines` | One row per `shipping_lines[]` element | |
| `stg_products` / `stg_customers` | Catalog / customer dimensions | Join keys: `store_id` + Woo ids. |
| `fct_orders` | One row per order | **Primary explore** for order totals, billing geo, payment, time-of-day. |
| `fct_order_lines` | One row per order line | Product / category / variant-style reporting; join catalog when `product_id` matches. |
| `fct_coupon_lines` | One row per coupon line | Coupon usage and discount totals. |
| `fct_shipping_lines` | One row per shipping line | Shipping method mix and shipping revenue. |

Do not sum revenue from `fct_orders` and `fct_order_lines` in the same chart (different grains). Prefer **orders** for store totals that match Woo admin order totals; use **order lines** for product/category splits.

Partial refunds and multi-step refunds are not fully modeled—use order status and totals for refund-heavy stores until refund JSON is staged.
