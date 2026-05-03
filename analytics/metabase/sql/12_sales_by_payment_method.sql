-- Revenue by payment gateway (donut / bar).

select
  coalesce(
    nullif(trim(payment_method_title), ''),
    nullif(trim(payment_method), ''),
    '(unknown)'
  ) as payment_method_label,
  count(*) as order_count,
  sum(order_total) as total_sales
from dbt_analytics.fct_orders
where store_id = {{store_id}}
  and lower(coalesce(status, '')) not in ('cancelled', 'failed', 'canceled')
group by 1
order by total_sales desc nulls last;
