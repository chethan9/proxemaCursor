# Semantic grain

| Model | Grain | Notes |
|-------|-------|--------|
| `stg_orders` | One row per synced order | Mirrors `public.orders`. |
| `fct_orders` | One row per order | **Primary explore** for order-count and revenue metrics. |

Do not mix `fct_orders` with future line-item marts in the same chart without understanding duplication risk.
