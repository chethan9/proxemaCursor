ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tax_status text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tax_class text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sold_individually boolean;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS virtual boolean;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS downloadable boolean;
NOTIFY pgrst, 'reload schema';