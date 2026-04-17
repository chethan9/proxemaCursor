-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  parent_id INTEGER,
  description TEXT,
  display TEXT,
  image JSONB,
  menu_order INTEGER DEFAULT 0,
  count INTEGER DEFAULT 0,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, woo_id)
);

-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  amount DECIMAL(10,2),
  discount_type TEXT,
  description TEXT,
  date_expires TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  individual_use BOOLEAN DEFAULT false,
  product_ids JSONB,
  excluded_product_ids JSONB,
  usage_limit INTEGER,
  usage_limit_per_user INTEGER,
  free_shipping BOOLEAN DEFAULT false,
  minimum_amount DECIMAL(10,2),
  maximum_amount DECIMAL(10,2),
  raw_data JSONB,
  date_created TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, woo_id)
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (public read for now)
CREATE POLICY "categories_select" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (true);
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (true);
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (true);

CREATE POLICY "coupons_select" ON coupons FOR SELECT USING (true);
CREATE POLICY "coupons_insert" ON coupons FOR INSERT WITH CHECK (true);
CREATE POLICY "coupons_update" ON coupons FOR UPDATE USING (true);
CREATE POLICY "coupons_delete" ON coupons FOR DELETE USING (true);