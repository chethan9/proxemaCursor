SELECT 
  'ALTER TABLE public.' || quote_ident(c.relname) || 
  ' ADD CONSTRAINT ' || quote_ident(con.conname) || ' ' ||
  pg_get_constraintdef(con.oid) || ';' AS ddl,
  con.contype
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY 
  CASE con.contype WHEN 'p' THEN 1 WHEN 'u' THEN 2 WHEN 'c' THEN 3 WHEN 'f' THEN 4 END,
  c.relname, con.conname;