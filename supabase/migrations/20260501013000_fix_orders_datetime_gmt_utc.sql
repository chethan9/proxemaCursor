-- Ensure Woo *_gmt fields are treated as UTC explicitly.
-- Fallback to store timezone when *_gmt is absent but local timestamp exists.

UPDATE orders o
SET
  date_created = CASE
    WHEN COALESCE(o.raw_data->>'date_created_gmt', '') <> ''
      THEN ((o.raw_data->>'date_created_gmt') || 'Z')::timestamptz
    WHEN COALESCE(o.raw_data->>'date_created', '') <> '' AND COALESCE(s.timezone, '') <> ''
      THEN (o.raw_data->>'date_created')::timestamp AT TIME ZONE s.timezone
    ELSE o.date_created
  END,
  date_modified = CASE
    WHEN COALESCE(o.raw_data->>'date_modified_gmt', '') <> ''
      THEN ((o.raw_data->>'date_modified_gmt') || 'Z')::timestamptz
    WHEN COALESCE(o.raw_data->>'date_modified', '') <> '' AND COALESCE(s.timezone, '') <> ''
      THEN (o.raw_data->>'date_modified')::timestamp AT TIME ZONE s.timezone
    ELSE o.date_modified
  END
FROM stores s
WHERE s.id = o.store_id
  AND (
    COALESCE(o.raw_data->>'date_created_gmt', '') <> ''
    OR COALESCE(o.raw_data->>'date_modified_gmt', '') <> ''
    OR (COALESCE(o.raw_data->>'date_created', '') <> '' AND COALESCE(s.timezone, '') <> '')
    OR (COALESCE(o.raw_data->>'date_modified', '') <> '' AND COALESCE(s.timezone, '') <> '')
  );
