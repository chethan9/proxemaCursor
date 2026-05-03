{{
  config(
    meta={
      "label": "Order line items (staging)",
      "group_label": "Commerce",
    }
  )
}}

/*
  Grain: one row per line_item JSON element on an order.
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
    li.elem,
    li.line_position
  from src as o
  cross join lateral jsonb_array_elements(
    coalesce(o.line_items::jsonb, '[]'::jsonb)
  ) with ordinality as li(elem, line_position)
)

select
  {{ dbt_utils.generate_surrogate_key(['store_id', 'order_id', 'line_position']) }} as order_line_id,
  order_id,
  store_id,
  order_woo_id,
  order_created_at,
  order_status,
  currency,
  customer_id,
  line_position,
  nullif(trim(elem->>'id'), '')::bigint as line_woo_id,
  nullif(trim(elem->>'product_id'), '')::bigint as product_woo_id,
  nullif(trim(elem->>'variation_id'), '')::bigint as variation_woo_id,
  coalesce(nullif(trim(elem->>'quantity'), ''), '0')::numeric(18, 4) as quantity,
  coalesce((nullif(trim(elem->>'subtotal'), ''))::numeric, 0)::numeric(18, 4) as line_subtotal,
  coalesce((nullif(trim(elem->>'total'), ''))::numeric, 0)::numeric(18, 4) as line_total,
  nullif(trim(elem->>'sku'), '') as line_sku,
  coalesce(trim(elem->>'name'), '') as line_item_name
from expanded
