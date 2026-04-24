SELECT 
  'ALTER TABLE public.' || quote_ident(tablename) || ' ENABLE ROW LEVEL SECURITY;' AS ddl
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
ORDER BY tablename;