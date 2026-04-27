CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  woo_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  count INTEGER DEFAULT 0,
  image JSONB,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, woo_id)
);

CREATE INDEX IF NOT EXISTS brands_store_id_idx ON public.brands(store_id);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_select_scoped" ON public.brands FOR SELECT USING (user_can_access_store(store_id));
CREATE POLICY "brands_insert_scoped" ON public.brands FOR INSERT WITH CHECK (user_can_access_store(store_id));
CREATE POLICY "brands_update_scoped" ON public.brands FOR UPDATE USING (user_can_access_store(store_id));
CREATE POLICY "brands_delete_scoped" ON public.brands FOR DELETE USING (user_can_access_store(store_id));

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brands JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.sync_runs DROP CONSTRAINT IF EXISTS sync_runs_aspect_check;
ALTER TABLE public.sync_runs ADD CONSTRAINT sync_runs_aspect_check
  CHECK (aspect IN ('products', 'variations', 'categories', 'orders', 'customers', 'coupons', 'tags', 'brands', 'all'));