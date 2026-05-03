/*
  Grain: one row per shipping_lines JSON element on an order.
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
    sl.elem,
    sl.line_position
  from src as o
  cross join lateral jsonb_array_elements(
    coalesce(o.shipping_lines::jsonb, '[]'::jsonb)
  ) with ordinality as sl(elem, line_position)
)

select
  {{ dbt_utils.generate_surrogate_key(['store_id', 'order_id', 'line_position']) }} as shipping_line_id,
  order_id,
  store_id,
  order_woo_id,
  order_created_at,
  order_status,
  currency,
  customer_id,
  nullif(trim(elem->>'method_id'), '') as shipping_method_id,
  coalesce(
    nullif(trim(elem->>'method_title'), ''),
    nullif(trim(elem->>'name'), ''),
    'Unknown'
  ) as shipping_method_title,
  coalesce((nullif(trim(elem->>'total'), ''))::numeric, 0)::numeric(18, 4) as shipping_line_total
from expanded
