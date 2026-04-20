CREATE TABLE IF NOT EXISTS product_variations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  woo_parent_id bigint NOT NULL,
  woo_id bigint NOT NULL,
  sku text,
  regular_price numeric(10,2),
  sale_price numeric(10,2),
  price numeric(10,2),
  stock_quantity integer,
  stock_status text,
  manage_stock boolean DEFAULT false,
  status text DEFAULT 'publish',
  virtual boolean DEFAULT false,
  downloadable boolean DEFAULT false,
  tax_class text,
  weight text,
  dimensions jsonb DEFAULT '{}'::jsonb,
  description text,
  attributes jsonb DEFAULT '[]'::jsonb,
  image jsonb,
  gallery jsonb DEFAULT '[]'::jsonb,
  menu_order integer DEFAULT 0,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (store_id, woo_id)
);

CREATE INDEX IF NOT EXISTS idx_pv_store_product ON product_variations(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_pv_store_parent ON product_variations(store_id, woo_parent_id);

ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pv_select" ON product_variations FOR SELECT USING (user_can_access_store(store_id));
CREATE POLICY "pv_insert" ON product_variations FOR INSERT WITH CHECK (user_can_access_store(store_id));
CREATE POLICY "pv_update" ON product_variations FOR UPDATE USING (user_can_access_store(store_id));
CREATE POLICY "pv_delete" ON product_variations FOR DELETE USING (user_can_access_store(store_id));