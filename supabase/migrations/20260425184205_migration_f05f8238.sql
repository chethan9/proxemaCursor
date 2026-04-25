SELECT 
  (SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='touch_payment_gateway_settings') AS touch_fn,
  (SELECT string_agg(
     'ALTER TABLE public.payment_gateway_settings ADD COLUMN ' || quote_ident(column_name) || ' ' || 
     CASE WHEN data_type='USER-DEFINED' THEN udt_name ELSE data_type END ||
     CASE WHEN character_maximum_length IS NOT NULL THEN '('||character_maximum_length||')' ELSE '' END ||
     CASE WHEN is_nullable='NO' THEN ' NOT NULL' ELSE '' END ||
     COALESCE(' DEFAULT '||column_default,'') || ';',
     E'\n' ORDER BY ordinal_position
   ) FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_gateway_settings') AS columns_ddl,
  (SELECT string_agg(
     'CREATE TRIGGER '||tg.tgname||' '||pg_get_triggerdef(tg.oid)||';', E'\n'
   ) FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='payment_gateway_settings' AND NOT tg.tgisinternal) AS triggers_ddl,
  (SELECT string_agg(
     'CREATE TRIGGER '||tg.tgname||' '||pg_get_triggerdef(tg.oid)||';', E'\n'
   ) FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname='plans' AND NOT tg.tgisinternal AND tg.tgname LIKE '%default_trial%') AS plans_trigger_ddl;