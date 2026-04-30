-- Backfill WooCommerce order timestamps from canonical *_gmt values in raw_data.
-- This corrects historical rows that may have been persisted using local timestamps
-- without timezone offsets.

UPDATE orders
SET
  date_created = CASE
    WHEN COALESCE(raw_data->>'date_created_gmt', '') <> ''
      THEN (raw_data->>'date_created_gmt')::timestamptz
    ELSE date_created
  END,
  date_modified = CASE
    WHEN COALESCE(raw_data->>'date_modified_gmt', '') <> ''
      THEN (raw_data->>'date_modified_gmt')::timestamptz
    ELSE date_modified
  END
WHERE
  COALESCE(raw_data->>'date_created_gmt', '') <> ''
  OR COALESCE(raw_data->>'date_modified_gmt', '') <> '';
