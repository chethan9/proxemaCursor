ALTER TABLE stores 
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS address jsonb NOT NULL DEFAULT '{}'::jsonb;