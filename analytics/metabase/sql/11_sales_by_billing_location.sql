-- Sales by billing country / state / city (map or table).

select
  coalesce(nullif(trim(billing_country), ''), '(unknown)') as billing_country,
  coalesce(nullif(trim(billing_state), ''), '') as billing_state,
  coalesce(nullif(trim(billing_city), ''), '') as billing_city,
  count(*) as order_count,
  sum(order_total) as total_sales
from dbt_analytics.fct_orders
where store_id = {{store_id}}
  and lower(coalesce(status, '')) not in ('cancelled', 'failed', 'canceled')
group by 1, 2, 3
order by total_sales desc nulls last;
