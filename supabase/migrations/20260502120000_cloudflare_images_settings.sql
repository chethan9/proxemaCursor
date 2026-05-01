-- Global Cloudflare Images settings (super-admin; credentials encrypted like AI providers)

CREATE TABLE IF NOT EXISTS public.cloudflare_images_settings (
  id uuid PRIMARY KEY DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid,
  enabled boolean NOT NULL DEFAULT false,
  prefer_database_over_env boolean NOT NULL DEFAULT true,
  account_id text,
  api_token_encrypted text,
  images_account_hash text,
  variant_thumb text NOT NULL DEFAULT 'thumb',
  variant_card text NOT NULL DEFAULT 'card',
  variant_edit text NOT NULL DEFAULT 'edit',
  variant_zoom text NOT NULL DEFAULT 'zoom',
  mirror_metrics_enabled boolean NOT NULL DEFAULT false,
  repair_batch_size integer CHECK (repair_batch_size IS NULL OR (repair_batch_size >= 10 AND repair_batch_size <= 500)),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.cloudflare_images_settings IS
  'Singleton (fixed id) Cloudflare Images API credentials and feature flags; use service role or super_admin in app.';

INSERT INTO public.cloudflare_images_settings (id, enabled)
VALUES ('a0000000-0000-4000-8000-000000000001'::uuid, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.cloudflare_images_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cloudflare_images_settings_super ON public.cloudflare_images_settings;
CREATE POLICY cloudflare_images_settings_super ON public.cloudflare_images_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
