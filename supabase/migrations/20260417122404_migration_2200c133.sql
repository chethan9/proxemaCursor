CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id BIGINT NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  role TEXT,
  billing JSONB,
  shipping JSONB,
  is_paying_customer BOOLEAN,
  avatar_url TEXT,
  orders_count INTEGER,
  total_spent DECIMAL(10,2),
  raw_data JSONB,
  date_created TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(store_id, woo_id)
);

CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_woo_id ON customers(woo_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_customers" ON customers FOR SELECT USING (true);
CREATE POLICY "public_insert_customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_customers" ON customers FOR UPDATE USING (true);