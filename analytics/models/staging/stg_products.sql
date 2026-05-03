with src as (
  select * from {{ source('proxema', 'products') }}
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
from src
