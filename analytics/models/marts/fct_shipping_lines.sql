{{
  config(
    meta={
      "label": "Shipping lines",
      "group_label": "Commerce",
    }
  )
}}

select *
from {{ ref('stg_shipping_lines') }}
where order_created_at is not null
  {{ store_id_filter('store_id') }}
