-- Completed / cancel / refund rates (single row). Tune status filters to your Woo labels.

with o as (
  select *
  from dbt_analytics.fct_orders
  where store_id = {{store_id}}
),
agg as (
  select
    count(*)::numeric as total,
    count(*) filter (where lower(status) = 'completed')::numeric as n_completed,
    count(*) filter (where lower(status) like '%cancel%')::numeric as n_canceled,
    count(*) filter (where lower(status) like '%refund%')::numeric as n_refunded
  from o
)
select
  n_completed / nullif(total, 0) as completed_rate,
  n_canceled / nullif(total, 0) as cancellation_rate,
  n_refunded / nullif(total, 0) as refund_rate,
  total as orders_in_scope
from agg;
