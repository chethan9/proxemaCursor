-- Sales by primary category (donut / bar).

select
  coalesce(nullif(trim(primary_category_name), ''), 'Uncategorized') as category_name,
  sum(quantity) as units_sold,
  sum(line_subtotal) as gross_line_sales,
  sum(line_total) as line_net_sales,
  count(distinct order_id) as order_count
from dbt_analytics.fct_order_lines
where store_id = {{store_id}}
group by 1
order by line_net_sales desc nulls last;
