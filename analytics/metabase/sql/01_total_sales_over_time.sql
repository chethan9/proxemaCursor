-- Total sales over time (daily). Optional: change date_trunc to 'week' | 'month' | 'year'.
-- Metabase: add required variable store_id (Text) → link to dashboard filter.

select
  date_trunc('day', order_created_at at time zone 'UTC') as day_utc,
  count(*) as order_count,
  sum(order_subtotal) as gross_sales,
  sum(discount_total) as discounts,
  sum(order_tax) as tax,
  sum(shipping_total) as shipping,
  sum(order_total) as total_sales
from dbt_analytics.fct_orders
where store_id = {{store_id}}
group by 1
order by 1;
