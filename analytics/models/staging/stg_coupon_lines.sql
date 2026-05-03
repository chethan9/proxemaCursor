/*
  Grain: one row per coupon_lines JSON element on an order.
*/
with src as (
  select * from {{ source('proxema', 'orders') }}
),

expanded as (
  select
    o.id::text as order_id,
    o.store_id::text as store_id,
    o.woo_id as order_woo_id,
    o.date_created::timestamptz as order_created_at,
    o.status as order_status,
    o.currency,
    o.customer_id,
    cp.elem,
    cp.line_position
  from src as o
  cross join lateral jsonb_array_elements(
    coalesce(o.coupon_lines::jsonb, '[]'::jsonb)
  ) with ordinality as cp(elem, line_position)
)

select
  {{ dbt_utils.generate_surrogate_key(['store_id', 'order_id', 'line_position']) }} as coupon_line_id,
  order_id,
  store_id,
  order_woo_id,
  order_created_at,
  order_status,
  currency,
  customer_id,
  upper(trim(coalesce(elem->>'code', ''))) as coupon_code,
  coalesce((nullif(trim(elem->>'discount'), ''))::numeric, 0)::numeric(18, 4) as coupon_discount,
  coalesce((nullif(trim(elem->>'total'), ''))::numeric, 0)::numeric(18, 4) as coupon_discount_total
from expanded
where coalesce(trim(elem->>'code'), '') != ''
