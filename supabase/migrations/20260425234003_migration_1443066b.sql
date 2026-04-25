ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.products
SET tags = COALESCE(raw_data->'tags', '[]'::jsonb)
WHERE (tags IS NULL OR tags = '[]'::jsonb)
  AND raw_data ? 'tags';

CREATE INDEX IF NOT EXISTS products_tags_gin ON public.products USING gin (tags);