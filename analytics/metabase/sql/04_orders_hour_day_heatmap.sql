-- Heatmap-friendly grid: weekday × hour UTC → order_count.

select
  order_weekday_label,
  order_dow_utc,
  order_hour_utc,
  count(*) as order_count
from dbt_analytics.fct_orders
where store_id = {{store_id}}
group by 1, 2, 3
order by order_dow_utc, order_hour_utc;
