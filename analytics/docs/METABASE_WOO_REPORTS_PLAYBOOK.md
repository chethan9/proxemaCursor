# Metabase: Woo-style sales & order reports (step-by-step)

Build these from **`dbt_analytics`** models after **Sync** in Metabase. Every question must be scoped with **`store_id`** (dashboard filter, **locked** for embed — slug **`store_id`**).

**Data limitations (today):** Refunded **amounts** are not fully split from JSON at line level; use **`status` = `refunded`** and order totals for a first pass. “Net sales” in the strict Woo sense is approximated by **`line_net_sales`** (lines) and **`order_total`** (orders).

---

## One-time: dashboard setup

1. **New dashboard** (e.g. “Sales & orders”).
2. Add a **filter** → **Text or Field** → column **`store_id`** from any `fct_*` table. Set **Linked filter** to all questions. For embedding, mark the filter **Locked** and slug **`store_id`**.
3. Add the questions below as cards; attach the same **`store_id`** filter to each.

**GUI vs SQL:** Prefer **Simple question** on a model table for speed. Use **Native query** from [`../metabase/sql/`](../metabase/sql/) when noted.

---

## 1. Sales reports

### 1.1 Total sales over time

| Item | Value |
|------|--------|
| **Chart** | Line |
| **Model** | `fct_orders` |
| **Time** | `order_created_at` → group by **Day** / **Week** / **Month** / **Year** (choose in “Summarize” or bucket). |
| **Metrics** | Sum `order_subtotal` (gross), Sum `discount_total`, Sum `order_tax`, Sum `shipping_total`, Sum `order_total` (total sales as recorded), **Count of rows** = orders. |
| **Optional series** | Add multiple metrics on one line chart, or small multiples. |

*Refunds as a series:* Add a second question filtered to `status` = `refunded`, sum `order_total` (magnitude for refunded orders), or skip until dbt adds refund facts.

### 1.2 Sales by product

| Item | Value |
|------|--------|
| **Chart** | Bar |
| **Model** | `fct_order_lines` |
| **Breakout** | `product_name` (or `product_sku`) |
| **Metrics** | Sum `line_subtotal` (gross), Sum `line_total` (net line), Sum `quantity` (units), **Count distinct** `order_id` (order count). |

### 1.3 Sales by product variant

| Item | Value |
|------|--------|
| **Chart** | Horizontal bar |
| **Model** | `fct_order_lines` |
| **Breakout** | `variant_label` (add `product_name` as second column if needed) |
| **Metrics** | Sum `line_total`, Sum `quantity` |

### 1.4 Sales by category

| Item | Value |
|------|--------|
| **Chart** | Bar or Donut |
| **Model** | `fct_order_lines` |
| **Breakout** | `primary_category_name` (filter empty if needed) |
| **Metrics** | Sum `line_total`, Sum `quantity` |

### 1.5 Sales by coupon

| Item | Value |
|------|--------|
| **Chart** | Bar |
| **Model** | `fct_coupon_lines` |
| **Breakout** | `coupon_code` |
| **Metrics** | Sum `coupon_discount_total`, **Count distinct** `order_id` (orders with coupon) |

### 1.6 Sales by customer

| Item | Value |
|------|--------|
| **Chart** | Table (sort by revenue); optional second question — Bar top 10 |
| **Model** | `fct_orders` |
| **Breakout** | `customer_email`, `customer_display_name` |
| **Metrics** | Sum `order_total`, **Count of rows**, Average `order_total` (AOV per customer) |

### 1.7 Sales by billing location

| Item | Value |
|------|--------|
| **Chart** | Bar (country / state / city) |
| **Model** | `fct_orders` |
| **Breakout** | `billing_country` OR `billing_state` OR `billing_city` (one chart each, or use hierarchy if you use Metabase drill) |
| **Metrics** | Sum `order_total`, **Count of rows** |

*Maps:* Metabase maps need geo fields or coordinates; **bar by country** is the reliable default.

### 1.8 Sales by payment method

| Item | Value |
|------|--------|
| **Chart** | Donut or Bar |
| **Model** | `fct_orders` |
| **Breakout** | `payment_method_title` (fallback: `payment_method`) |
| **Metrics** | Sum `order_total`, **Count of rows** |

### 1.9 Average order value over time

| Item | Value |
|------|--------|
| **Chart** | Line |
| **Model** | `fct_orders` |
| **Time** | `order_created_at` by day/week/month |
| **Metric** | Average of `order_total` (**not** sum÷count in head — use Metabase **Average**) |

Or use native SQL: [`../metabase/sql/05_aov_over_time.sql`](../metabase/sql/05_aov_over_time.sql).

---

## 2. Order reports

### 2.1 Orders over time

| Item | Value |
|------|--------|
| **Chart** | Line (multiple series) |
| **Model** | `fct_orders` |
| **Time** | `order_created_at` by day |
| **Approach A** | One line: **Count of rows** (all orders). |
| **Approach B** | Duplicate question per status (`completed`, `processing`, `cancelled`, `refunded`, …) with filter on `status`, combine on dashboard. |
| **Approach C** | Native SQL pivot: [`../metabase/sql/03_orders_over_time_by_status.sql`](../metabase/sql/03_orders_over_time_by_status.sql). |

### 2.2 Orders by status

| Item | Value |
|------|--------|
| **Chart** | Donut or Bar |
| **Model** | `fct_orders` |
| **Breakout** | `status` |
| **Metrics** | **Count of rows**, Sum `order_total` |

### 2.3 Orders by product

| Item | Value |
|------|--------|
| **Chart** | Bar |
| **Model** | `fct_order_lines` |
| **Breakout** | `product_name` |
| **Metric** | **Count distinct** `order_id` (how many orders included this product) |

### 2.4 Refunded orders

| Item | Value |
|------|--------|
| **Chart** | Bar |
| **Model** | `fct_orders` |
| **Filter** | `status` = `refunded` (match your Woo normalized statuses) |
| **Breakout** | `order_number` or date bucket |
| **Metrics** | Sum `order_total`, **Count of rows** |

*Refund reason:* Not in current mart unless you extend dbt.

### 2.5 Canceled orders

| Item | Value |
|------|--------|
| **Chart** | Bar |
| **Model** | `fct_orders` |
| **Filter** | `status` in cancelled-like values (`cancelled`, `canceled`, … — check your data) |
| **Metrics** | **Count of rows**, Sum `order_total` |

### 2.6 Orders by payment method

| Item | Value |
|------|--------|
| **Chart** | Donut |
| **Model** | `fct_orders` |
| **Breakout** | `payment_method_title` |
| **Metrics** | **Count of rows**, Sum `order_total` |

### 2.7 Orders by shipping method

| Item | Value |
|------|--------|
| **Chart** | Bar |
| **Model** | `fct_shipping_lines` |
| **Breakout** | `shipping_method_title` |
| **Metrics** | **Count distinct** `order_id`, Sum `shipping_line_total` |

### 2.8 Orders by hour / day (heatmap)

| Item | Value |
|------|--------|
| **Chart** | Pivot table styled as heatmap, or native SQL |
| **Model** | `fct_orders` |
| **Rows** | `order_weekday_label` or `order_dow_utc` |
| **Columns** | `order_hour_utc` |
| **Metric** | **Count of rows** |

Native SQL helper: [`../metabase/sql/04_orders_hour_day_heatmap.sql`](../metabase/sql/04_orders_hour_day_heatmap.sql).

---

## 3. Rates & extra metrics (custom columns / SQL)

| Metric | How |
|--------|-----|
| **Completed order rate** | Metabase **Custom column** or formula: `count(if(status='completed')) / count` — often easier in **Native SQL** with conditional aggregates. |
| **Cancellation / refund rate** | Same pattern; filter denominator to date range. |
| **Average items per order** | On `fct_order_lines`: `sum(quantity) / distinct count(order_id)` in SQL or two-stage question. |

---

## 4. Register in Proxema

After you save a **dashboard**, note **`/dashboard/<id>`**. In **Admin → Standard reports**, add a Metabase row with your public site URL, **`dashboard`**, and that **id**. Match **`METABASE_EMBEDDING_SECRET`** and **`ALLOWED_STANDARD_REPORT_HOSTS`** — see [`METABASE_STANDARD_REPORTS.md`](./METABASE_STANDARD_REPORTS.md).
