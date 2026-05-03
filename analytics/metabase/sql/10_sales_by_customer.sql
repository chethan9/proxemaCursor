-- Top customers by revenue (table / bar top-N).

select
  coalesce(nullif(trim(customer_email), ''), '(no email)') as customer_email,
  coalesce(nullif(trim(customer_display_name), ''), '') as customer_display_name,
  count(*) as orders,
  sum(order_total) as total_spent,
  avg(order_total) as avg_order_value
from dbt_analytics.fct_orders
where store_id = {{store_id}}
  and lower(coalesce(status, '')) not in ('cancelled', 'failed', 'canceled')
group by 1, 2
order by total_spent desc nulls last;
