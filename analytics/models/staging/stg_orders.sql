with src as (
  select * from {{ source('proxema', 'orders') }}
)

select
  id::text as order_id,
  store_id::text as store_id,
  woo_id,
  order_number,
  date_created::timestamptz as order_created_at,
  date_modified::timestamptz as order_modified_at,
  status,
  currency,
  coalesce(total, 0)::numeric(18, 4) as order_total,
  coalesce(subtotal, 0)::numeric(18, 4) as order_subtotal,
  coalesce(total_tax, 0)::numeric(18, 4) as order_tax,
  coalesce(shipping_total, 0)::numeric(18, 4) as shipping_total,
  coalesce(discount_total, 0)::numeric(18, 4) as discount_total,
  customer_id,
  payment_method,
  payment_method_title
from src
