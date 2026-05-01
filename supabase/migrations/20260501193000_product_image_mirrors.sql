-- Cloudflare Images mirror metadata + denormalized URLs on products for fast UI reads.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_mirror_urls jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.products.image_mirror_urls IS
  'Map of storage_key (base64url UTF-8 of normalized image URL) -> { thumb, card, edit, zoom } Cloudflare Images delivery URLs';

CREATE TABLE IF NOT EXISTS public.product_image_mirrors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  src_normalized text NOT NULL,
  storage_key text NOT NULL,
  cf_image_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'deleting')),
  error text,
  source_kind text NOT NULL DEFAULT 'sync' CHECK (source_kind IN ('sync', 'save', 'repair')),
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, product_id, storage_key)
);

CREATE INDEX IF NOT EXISTS idx_product_image_mirrors_store_status
  ON public.product_image_mirrors (store_id, status);

CREATE INDEX IF NOT EXISTS idx_product_image_mirrors_store_storage_key
  ON public.product_image_mirrors (store_id, storage_key);

CREATE INDEX IF NOT EXISTS idx_product_image_mirrors_cf_image_id
  ON public.product_image_mirrors (cf_image_id)
  WHERE cf_image_id IS NOT NULL;

COMMENT ON TABLE public.product_image_mirrors IS
  'Tracks Cloudflare Images uploads per product image src; used for cleanup and dedupe.';

ALTER TABLE public.product_image_mirrors ENABLE ROW LEVEL SECURITY;

-- Deny direct client access; service_role bypasses RLS for API routes.

CREATE OR REPLACE FUNCTION public.set_product_image_mirrors_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_image_mirrors_updated_at ON public.product_image_mirrors;
CREATE TRIGGER trg_product_image_mirrors_updated_at
  BEFORE UPDATE ON public.product_image_mirrors
  FOR EACH ROW EXECUTE FUNCTION public.set_product_image_mirrors_updated_at();
