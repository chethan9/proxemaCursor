-- Average order value by day (mean of order_total per day).

select
  date_trunc('day', order_created_at at time zone 'UTC') as day_utc,
  count(*) as order_count,
  sum(order_total) as total_sales,
  avg(order_total) as avg_order_value
from dbt_analytics.fct_orders
where store_id = {{store_id}}
group by 1
order by 1;
