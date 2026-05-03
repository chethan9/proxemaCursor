-- Speed up customer list when user preference sort is "total_spent desc".
CREATE INDEX IF NOT EXISTS idx_customers_store_total_spent_desc
  ON customers (store_id, total_spent DESC, id DESC);
