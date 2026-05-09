-- Mirror WooCommerce global product attributes + terms (per store) for sync/UI reads.

CREATE TABLE IF NOT EXISTS public.product_global_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  woo_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  slug TEXT,
  type TEXT,
  order_by TEXT,
  has_archives BOOLEAN DEFAULT false,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, woo_id)
);

CREATE INDEX IF NOT EXISTS idx_product_global_attributes_store ON public.product_global_attributes(store_id);

CREATE TABLE IF NOT EXISTS public.product_global_attribute_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  attribute_woo_id INTEGER NOT NULL,
  woo_id INTEGER NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  slug TEXT,
  description TEXT,
  menu_order INTEGER DEFAULT 0,
  count INTEGER DEFAULT 0,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, attribute_woo_id, woo_id)
);

CREATE INDEX IF NOT EXISTS idx_pgat_store_attr ON public.product_global_attribute_terms(store_id, attribute_woo_id);

ALTER TABLE public.product_global_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_global_attribute_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_global_attributes_select_scoped"
  ON public.product_global_attributes FOR SELECT TO authenticated
  USING (public.user_can_access_store(store_id) OR public.is_super_admin());

CREATE POLICY "product_global_attributes_insert_scoped"
  ON public.product_global_attributes FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_store(store_id) OR public.is_super_admin());

CREATE POLICY "product_global_attributes_update_scoped"
  ON public.product_global_attributes FOR UPDATE TO authenticated
  USING (public.user_can_access_store(store_id) OR public.is_super_admin())
  WITH CHECK (public.user_can_access_store(store_id) OR public.is_super_admin());

CREATE POLICY "product_global_attributes_delete_scoped"
  ON public.product_global_attributes FOR DELETE TO authenticated
  USING (public.user_can_access_store(store_id) OR public.is_super_admin());

CREATE POLICY "product_global_attribute_terms_select_scoped"
  ON public.product_global_attribute_terms FOR SELECT TO authenticated
  USING (public.user_can_access_store(store_id) OR public.is_super_admin());

CREATE POLICY "product_global_attribute_terms_insert_scoped"
  ON public.product_global_attribute_terms FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_store(store_id) OR public.is_super_admin());

CREATE POLICY "product_global_attribute_terms_update_scoped"
  ON public.product_global_attribute_terms FOR UPDATE TO authenticated
  USING (public.user_can_access_store(store_id) OR public.is_super_admin())
  WITH CHECK (public.user_can_access_store(store_id) OR public.is_super_admin());

CREATE POLICY "product_global_attribute_terms_delete_scoped"
  ON public.product_global_attribute_terms FOR DELETE TO authenticated
  USING (public.user_can_access_store(store_id) OR public.is_super_admin());

ALTER TABLE public.sync_runs DROP CONSTRAINT IF EXISTS sync_runs_aspect_check;
ALTER TABLE public.sync_runs ADD CONSTRAINT sync_runs_aspect_check
  CHECK (aspect IN (
    'products', 'variations', 'categories', 'orders', 'customers', 'coupons', 'tags', 'brands',
    'product_attributes', 'all'
  ));

-- Note: keep this list in sync with inserts into public.sync_runs across API routes.
