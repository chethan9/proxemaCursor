-- Orders explorer supports sorting by total / synced_at / created_at / order_number,
-- but only (store_id, date_created) was indexed. Sorting 10k+ orders for a store
-- by an unindexed numeric column hit the authenticated role's statement_timeout
-- and returned HTTP 500 on the client (service_role works because its timeout is
-- relaxed). Add per-store indexes for every sortable column we expose.

CREATE INDEX IF NOT EXISTS idx_orders_store_total_desc
  ON public.orders (store_id, total DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_orders_store_synced_at_desc
  ON public.orders (store_id, synced_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_orders_store_created_at_desc
  ON public.orders (store_id, created_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_orders_store_order_number_desc
  ON public.orders (store_id, order_number DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_orders_store_status_date_created_desc
  ON public.orders (store_id, status, date_created DESC NULLS LAST);
