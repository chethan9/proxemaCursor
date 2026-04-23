ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS billing_currency text,
  ADD COLUMN IF NOT EXISTS avatar_url text;