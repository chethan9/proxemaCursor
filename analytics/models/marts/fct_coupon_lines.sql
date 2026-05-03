{{
  config(
    meta={
      "label": "Coupon lines",
      "group_label": "Commerce",
    }
  )
}}

select *
from {{ ref('stg_coupon_lines') }}
where order_created_at is not null
  {{ store_id_filter('store_id') }}
