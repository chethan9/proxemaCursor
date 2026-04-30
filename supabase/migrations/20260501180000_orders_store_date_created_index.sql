-- Speed up typical explorer query: filter by store_id, order by date_created desc.
CREATE INDEX IF NOT EXISTS idx_orders_store_date_created_desc
  ON public.orders (store_id, date_created DESC NULLS LAST);
