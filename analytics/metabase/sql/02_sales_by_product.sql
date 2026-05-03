-- Sales by product (line grain aggregates).

select
  product_name,
  product_sku,
  sum(quantity) as units_sold,
  sum(line_subtotal) as gross_line_sales,
  sum(line_total) as line_net_sales,
  count(distinct order_id) as order_count
from dbt_analytics.fct_order_lines
where store_id = {{store_id}}
group by 1, 2
order by line_net_sales desc nulls last;
