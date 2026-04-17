CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  sku TEXT,
  price DECIMAL(10,2),
  regular_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  stock_quantity INTEGER,
  stock_status TEXT,
  status TEXT,
  type TEXT,
  description TEXT,
  short_description TEXT,
  categories JSONB,
  images JSONB,
  attributes JSONB,
  raw_data JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(store_id, woo_id)
);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_woo_id ON products(woo_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_products" ON products FOR SELECT USING (true);
CREATE POLICY "public_insert_products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_products" ON products FOR UPDATE USING (true);