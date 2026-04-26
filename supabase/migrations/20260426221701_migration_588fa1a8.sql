ALTER TABLE public.products ADD COLUMN IF NOT EXISTS manage_stock boolean;
NOTIFY pgrst, 'reload schema';