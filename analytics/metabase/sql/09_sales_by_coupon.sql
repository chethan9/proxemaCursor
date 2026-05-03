-- Coupon usage and discount impact.

select
  coalesce(nullif(trim(coupon_code), ''), '(none)') as coupon_code,
  sum(coupon_discount_total) as discount_amount,
  count(distinct order_id) as orders_with_coupon
from dbt_analytics.fct_coupon_lines
where store_id = {{store_id}}
group by 1
order by discount_amount desc nulls last;
