-- Orders per day, pivoted by status (adjust status literals to match your Woo data).

select
  date_trunc('day', order_created_at at time zone 'UTC') as day_utc,
  count(*) filter (where lower(status) in ('completed', 'processing')) as completed_or_processing,
  count(*) filter (where lower(status) like '%pending%' or lower(status) like '%on-hold%') as pending_like,
  count(*) filter (where lower(status) like '%cancel%') as canceled,
  count(*) filter (where lower(status) like '%refund%') as refunded,
  count(*) as orders_total
from dbt_analytics.fct_orders
where store_id = {{store_id}}
group by 1
order by 1;
