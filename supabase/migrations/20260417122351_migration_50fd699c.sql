ALTER TABLE stores ADD COLUMN IF NOT EXISTS sync_interval integer NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS next_sync_at timestamp with time zone NULL;