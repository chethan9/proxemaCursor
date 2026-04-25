SELECT 
  (SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='unmark_other_default_trials') AS unmark_fn,
  (SELECT string_agg(pg_get_triggerdef(tg.oid)||';', E'\n')
   FROM pg_trigger tg JOIN pg_class c ON c.oid=tg.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='plans' AND NOT tg.tgisinternal) AS plans_triggers,
  (SELECT string_agg(
     'CREATE POLICY '||quote_ident(policyname)||' ON storage.objects FOR '||cmd||
     CASE WHEN qual IS NOT NULL THEN ' USING ('||qual||')' ELSE '' END ||
     CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK ('||with_check||')' ELSE '' END ||';',
     E'\n'
   ) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' 
     AND policyname IN ('auth_upload','auth_update','auth_delete','public_read')) AS storage_policies;