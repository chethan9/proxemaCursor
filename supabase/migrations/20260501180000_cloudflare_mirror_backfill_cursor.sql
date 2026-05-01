-- Cursor for scheduled Cloudflare image mirror backfill (paginates products.id)

ALTER TABLE public.cloudflare_images_settings
  ADD COLUMN IF NOT EXISTS mirror_backfill_after_product_id uuid NULL;

COMMENT ON COLUMN public.cloudflare_images_settings.mirror_backfill_after_product_id IS
  'Exclusive lower bound for automated backfill cron (products.id). Null = start from beginning.';
