-- Speed up default customers pagination for large stores.
-- Query pattern: WHERE store_id = ? ORDER BY date_created DESC LIMIT/OFFSET.
CREATE INDEX IF NOT EXISTS idx_customers_store_date_created_desc
  ON customers (store_id, date_created DESC, id DESC);

-- Keep alternative list sort paths responsive.
CREATE INDEX IF NOT EXISTS idx_customers_store_synced_at_desc
  ON customers (store_id, synced_at DESC, id DESC);
