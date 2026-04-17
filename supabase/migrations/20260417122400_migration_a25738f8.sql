CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id BIGINT NOT NULL,
  order_number TEXT,
  status TEXT,
  currency TEXT,
  total DECIMAL(10,2),
  subtotal DECIMAL(10,2),
  total_tax DECIMAL(10,2),
  shipping_total DECIMAL(10,2),
  discount_total DECIMAL(10,2),
  payment_method TEXT,
  payment_method_title TEXT,
  customer_id BIGINT,
  billing JSONB,
  shipping JSONB,
  line_items JSONB,
  shipping_lines JSONB,
  fee_lines JSONB,
  coupon_lines JSONB,
  raw_data JSONB,
  date_created TIMESTAMP WITH TIME ZONE,
  date_modified TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(store_id, woo_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_woo_id ON orders(woo_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date_created ON orders(date_created DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_orders" ON orders FOR SELECT USING (true);
CREATE POLICY "public_insert_orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_orders" ON orders FOR UPDATE USING (true);