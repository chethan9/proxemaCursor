SELECT 
  'CREATE TABLE IF NOT EXISTS public.' || quote_ident(c.relname) || ' (' || E'\n  ' ||
  string_agg(
    quote_ident(a.attname) || ' ' ||
    pg_catalog.format_type(a.atttypid, a.atttypmod) ||
    CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN ad.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid) ELSE '' END,
    E',\n  ' ORDER BY a.attnum
  ) || E'\n);' AS ddl,
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY c.relname, c.oid
ORDER BY c.relname;