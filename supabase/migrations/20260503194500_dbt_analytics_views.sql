-- Analytics views for Metabase / dbt (mirrors analytics/ dbt models). Idempotent CREATE OR REPLACE.
-- Source: public.orders, public.products, public.customers
-- Surrogate keys match dbt_utils.generate_surrogate_key (null placeholder + '-' join + md5).

create or replace view dbt_analytics.stg_orders as
with src as (
  select * from public.orders
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
  payment_method_title,
  nullif(trim(billing::jsonb->>'country'), '') as billing_country,
  nullif(trim(billing::jsonb->>'state'), '') as billing_state,
  nullif(trim(billing::jsonb->>'city'), '') as billing_city
from src;

create or replace view dbt_analytics.stg_products as
with src as (
  select * from public.products
)
select
  id::text as product_row_id,
  store_id::text as store_id,
  woo_id,
  name as product_name,
  sku as product_sku,
  type as product_type,
  categories,
  status as product_status
from src;

create or replace view dbt_analytics.stg_customers as
with src as (
  select * from public.customers
)
select
  id::text as customer_row_id,
  store_id::text as store_id,
  woo_id,
  email as customer_email,
  first_name as customer_first_name,
  last_name as customer_last_name,
  username as customer_username
from src;

create or replace view dbt_analytics.stg_order_lines as
with src as (
  select * from public.orders
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
  md5(
    coalesce(store_id::text, '_dbt_utils_surrogate_key_null_') || '-' ||
    coalesce(order_id::text, '_dbt_utils_surrogate_key_null_') || '-' ||
    coalesce(line_position::text, '_dbt_utils_surrogate_key_null_')
  ) as order_line_id,
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
from expanded;

create or replace view dbt_analytics.stg_coupon_lines as
with src as (
  select * from public.orders
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
  md5(
    coalesce(store_id::text, '_dbt_utils_surrogate_key_null_') || '-' ||
    coalesce(order_id::text, '_dbt_utils_surrogate_key_null_') || '-' ||
    coalesce(line_position::text, '_dbt_utils_surrogate_key_null_')
  ) as coupon_line_id,
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
where coalesce(trim(elem->>'code'), '') != '';

create or replace view dbt_analytics.stg_shipping_lines as
with src as (
  select * from public.orders
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
  md5(
    coalesce(store_id::text, '_dbt_utils_surrogate_key_null_') || '-' ||
    coalesce(order_id::text, '_dbt_utils_surrogate_key_null_') || '-' ||
    coalesce(line_position::text, '_dbt_utils_surrogate_key_null_')
  ) as shipping_line_id,
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
from expanded;

create or replace view dbt_analytics.fct_orders as
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
from dbt_analytics.stg_orders as o
left join dbt_analytics.stg_customers as c
  on o.store_id = c.store_id
  and o.customer_id is not null
  and o.customer_id = c.woo_id
where o.order_created_at is not null;

create or replace view dbt_analytics.fct_order_lines as
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
from dbt_analytics.stg_order_lines as ol
left join dbt_analytics.stg_products as p
  on ol.store_id = p.store_id
  and ol.product_woo_id = p.woo_id
where ol.order_created_at is not null;

create or replace view dbt_analytics.fct_coupon_lines as
select *
from dbt_analytics.stg_coupon_lines
where order_created_at is not null;

create or replace view dbt_analytics.fct_shipping_lines as
select *
from dbt_analytics.stg_shipping_lines
where order_created_at is not null;

grant select on dbt_analytics.stg_orders to postgres;
grant select on dbt_analytics.stg_products to postgres;
grant select on dbt_analytics.stg_customers to postgres;
grant select on dbt_analytics.stg_order_lines to postgres;
grant select on dbt_analytics.stg_coupon_lines to postgres;
grant select on dbt_analytics.stg_shipping_lines to postgres;
grant select on dbt_analytics.fct_orders to postgres;
grant select on dbt_analytics.fct_order_lines to postgres;
grant select on dbt_analytics.fct_coupon_lines to postgres;
grant select on dbt_analytics.fct_shipping_lines to postgres;
