{{
  config(
    meta={
      "label": "Order lines",
      "group_label": "Commerce",
    }
  )
}}

/*
  Grain: one row per order line item (product row). Joins catalog for category/SKU when product_id matches.
  Sales metrics here sum line_subtotal / line_total — do not mix with fct_orders revenue on the same chart.
*/
select
  ol.order_line_id,
  ol.order_id,
  ol.store_id,
  ol.order_woo_id,
  ol.order_created_at,
  ol.order_status,
  ol.currency,
  ol.customer_id,
  ol.line_position,
  ol.line_woo_id,
  ol.product_woo_id,
  ol.variation_woo_id,
  ol.quantity,
  ol.line_subtotal,
  ol.line_total,
  ol.line_sku,
  ol.line_item_name,
  coalesce(p.product_name, ol.line_item_name) as product_name,
  coalesce(nullif(p.product_sku, ''), ol.line_sku) as product_sku,
  p.product_type,
  ol.line_item_name as variant_label,
  case
    when ol.variation_woo_id is not null and ol.variation_woo_id > 0 then true
    else false
  end as is_variation,
  coalesce(p.categories::jsonb->0->>'name', 'Uncategorized') as primary_category_name
from {{ ref('stg_order_lines') }} as ol
left join {{ ref('stg_products') }} as p
  on ol.store_id = p.store_id
  and ol.product_woo_id = p.woo_id
where ol.order_created_at is not null
  {{ store_id_filter('ol.store_id') }}
