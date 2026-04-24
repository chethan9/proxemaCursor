SELECT 'CREATE TYPE public.' || quote_ident(t.typname) || ' AS ENUM (' ||
  string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) || ');' AS ddl
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;