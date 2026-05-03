# Woo-style reports → Metabase + `dbt_analytics`

Use **`store_id`** on every Metabase question/dashboard (locked parameter; default slug **`store_id`** — align with **`METABASE_STORE_PARAM_SLUG`** in Proxema). Times default to **UTC** unless you add a store timezone in dbt later.

## Sales reports

| Report | Model / starting point | Dimensions / filters | Measures | Suggested viz |
|--------|------------------------|----------------------|----------|---------------|
| Total sales over time | `fct_orders` | `order_created_at` (day/week/month) | `total_revenue`, `total_tax`, `total_shipping`, `total_discounts`, `total_subtotal`, `order_count` | Line |
| Sales by product | `fct_order_lines` | `product_name` or `product_sku` | `gross_line_sales` or `line_net_sales`, `units_sold`, `order_count` | Bar |
| Sales by product variant | `fct_order_lines` | `variant_label` (and optionally `product_name`) | `line_net_sales`, `units_sold` | Horizontal bar |
| Sales by category | `fct_order_lines` | `primary_category_name` | `line_net_sales`, `units_sold` | Donut or bar |
| Sales by coupon | `fct_coupon_lines` | `coupon_code`, `order_created_at` | `total_coupon_discount`, `orders_with_coupon` | Bar |
| Sales by customer | `fct_orders` | `customer_email`, `customer_display_name` | `total_revenue`, `order_count`, `avg_order_value` | Table + bar |
| Sales by billing location | `fct_orders` | `billing_country`, `billing_state`, or `billing_city` | `total_revenue`, `order_count` | Bar (maps need Geo in Metabase) |
| Sales by payment method | `fct_orders` | `payment_method_title` or `payment_method` | `total_revenue`, `order_count` | Donut |
| Average order value over time | `fct_orders` | `order_created_at` | `avg_order_value`, optionally `order_count` | Line |

### Metrics mapping (approximate Woo semantics)

| Concept | Where |
|---------|--------|
| Gross sales (order-level) | Sum `total_subtotal` on **`fct_orders`** |
| Discounts | Sum `total_discounts` |
| Tax / shipping | Sum `total_tax` / `total_shipping` |
| “Total sales” (paid total) | Sum `total_revenue` (`order_total`) |
| Gross / net at **line** level | Sum `gross_line_sales` / `line_net_sales` on **`fct_order_lines`** |
| AOV | `avg_order_value` on **`fct_orders`** |

Refunds are **not** split from JSON yet—filter `status` (e.g. `refunded`) or extend dbt with refund staging when needed.

## Order reports

| Report | Model | Dimensions | Measures | Chart |
|--------|-------|------------|----------|-------|
| Orders over time | `fct_orders` | `order_created_at` | `order_count`; pivot `status` | Line |
| Orders by status | `fct_orders` | `status` | `order_count`, `total_revenue` | Donut |
| Orders by product | `fct_order_lines` | `product_name` | `order_count` (distinct orders per product) | Bar |
| Refunded orders | `fct_orders` | filter `status = refunded` | `total_revenue`, `order_count` | Bar |
| Canceled orders | `fct_orders` | filter `status = cancelled` | `order_count`, `total_revenue` | Bar |
| Orders by payment method | `fct_orders` | `payment_method_title` | `order_count`, `total_revenue` | Donut |
| Orders by shipping method | `fct_shipping_lines` | `shipping_method_title` | `order_count`, `total_shipping_charged` | Bar |
| Orders by hour / day | `fct_orders` | `order_hour_utc`, `order_weekday_label` or `order_dow_utc` | `order_count` or `total_revenue` | Heatmap |

### Rates (completed / cancel / refund %)

Use Metabase **custom columns** or saved metrics: count distinct orders filtered by status ÷ overall order count for the same date range.

### Average items per order

On **`fct_order_lines`**: `units_sold` ÷ distinct `order_id`, or aggregate in SQL later if you want a native metric.

---

After `dbt build`, refresh Metabase metadata if needed. Register dashboards in Proxema **Admin → Standard reports** — see [`METABASE_STANDARD_REPORTS.md`](./METABASE_STANDARD_REPORTS.md).
