-- Add timezone column to stores table.
-- Used by site home dashboard to compute "today/week/month" boundaries in the store's local time.
-- This migration file was missing (two prior 0-byte migrations referenced this column), causing
-- production rename/save to fail with "Could not find the 'timezone' column of 'stores'".
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS timezone text;
COMMENT ON COLUMN public.stores.timezone IS 'IANA timezone string (e.g. Asia/Kuwait). Null = use viewer''s browser tz.';