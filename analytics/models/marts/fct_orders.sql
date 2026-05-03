{{
  config(
    meta={
      "label": "Orders",
      "group_label": "Commerce",
    }
  )
}}

/*
  Grain: one row per order (per store).
  Use this explore for order counts and revenue totals — do not join to line-level facts in the same chart.
*/
select
  order_id,
  store_id,
  woo_id,
  order_number,
  order_created_at,
  order_modified_at,
  status,
  currency,
  order_total,
  order_subtotal,
  order_tax,
  shipping_total,
  discount_total,
  customer_id,
  payment_method,
  payment_method_title
from {{ ref('stg_orders') }}
where order_created_at is not null
  {{ store_id_filter('store_id') }}
