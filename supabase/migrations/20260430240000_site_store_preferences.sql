-- Per-store preferences (wizard + settings): region, merchandising metadata, completion gate.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS site_preferences_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS store_type text,
  ADD COLUMN IF NOT EXISTS acquisition_source text,
  ADD COLUMN IF NOT EXISTS acquisition_source_detail text;

COMMENT ON COLUMN public.stores.site_preferences_completed_at IS 'Set when user completes blocking store preferences wizard.';
COMMENT ON COLUMN public.stores.country_code IS 'ISO 3166-1 alpha-2 country for this store.';
COMMENT ON COLUMN public.stores.store_type IS 'Merchant vertical / Woo-style industry key.';
COMMENT ON COLUMN public.stores.acquisition_source IS 'How they found us preset key.';
COMMENT ON COLUMN public.stores.acquisition_source_detail IS 'Free text when acquisition_source is other; optional notes.';
