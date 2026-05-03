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
  Revenue columns mirror WooCommerce order-level totals. Compare to Woo reports before trusting net/refund splits;
  line-level refunds are not unpacked from JSON here.
*/
select
  o.order_id,
  o.store_id,
  o.woo_id,
  o.order_number,
  o.order_created_at,
  o.order_modified_at,
  o.status,
  o.currency,
  o.order_total,
  o.order_subtotal,
  o.order_tax,
  o.shipping_total,
  o.discount_total,
  o.customer_id,
  o.payment_method,
  o.payment_method_title,
  o.billing_country,
  o.billing_state,
  o.billing_city,
  extract(hour from o.order_created_at at time zone 'UTC')::int as order_hour_utc,
  extract(dow from o.order_created_at at time zone 'UTC')::int as order_dow_utc,
  case extract(dow from o.order_created_at at time zone 'UTC')::int
    when 0 then 'Sun'
    when 1 then 'Mon'
    when 2 then 'Tue'
    when 3 then 'Wed'
    when 4 then 'Thu'
    when 5 then 'Fri'
    when 6 then 'Sat'
  end as order_weekday_label,
  c.customer_email,
  trim(
    concat(
      coalesce(c.customer_first_name || ' ', ''),
      coalesce(c.customer_last_name, '')
    )
  ) as customer_display_name
from {{ ref('stg_orders') }} as o
left join {{ ref('stg_customers') }} as c
  on o.store_id = c.store_id
  and o.customer_id is not null
  and o.customer_id = c.woo_id
where o.order_created_at is not null
  {{ store_id_filter('o.store_id') }}
