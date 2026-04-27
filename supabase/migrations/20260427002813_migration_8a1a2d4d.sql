ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pending_action TEXT,
  ADD COLUMN IF NOT EXISTS pending_job_id UUID,
  ADD COLUMN IF NOT EXISTS pending_at TIMESTAMPTZ;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pending_action TEXT,
  ADD COLUMN IF NOT EXISTS pending_job_id UUID,
  ADD COLUMN IF NOT EXISTS pending_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_pending_action ON products(pending_action) WHERE pending_action IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_pending_action ON orders(pending_action) WHERE pending_action IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_pending_job_id ON products(pending_job_id) WHERE pending_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_pending_job_id ON orders(pending_job_id) WHERE pending_job_id IS NOT NULL;

COMMENT ON COLUMN products.pending_action IS 'Lock marker set when entity is queued in a bulk_job; cleared on completion';
COMMENT ON COLUMN orders.pending_action IS 'Lock marker set when entity is queued in a bulk_job; cleared on completion';