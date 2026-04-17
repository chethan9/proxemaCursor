-- Add short_id column to stores for unique display ID
ALTER TABLE stores ADD COLUMN IF NOT EXISTS short_id VARCHAR(8);

-- Generate short IDs for existing stores
UPDATE stores SET short_id = UPPER(SUBSTR(id::text, 1, 8)) WHERE short_id IS NULL;