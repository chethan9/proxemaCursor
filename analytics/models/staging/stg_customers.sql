with src as (
  select * from {{ source('proxema', 'customers') }}
)

select
  id::text as customer_row_id,
  store_id::text as store_id,
  woo_id,
  email as customer_email,
  first_name as customer_first_name,
  last_name as customer_last_name,
  username as customer_username
from src
