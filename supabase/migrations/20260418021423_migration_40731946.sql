DO $$
DECLARE
  tbl text;
  tables_to_scope text[] := ARRAY[
    'products','orders','customers','categories','tags','coupons',
    'sync_runs','webhook_events',
    'api_keys','api_requests',
    'entity_history','deleted_entities'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_scope
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
      EXECUTE format('DROP POLICY IF EXISTS "%s_public_read" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_public_write" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_anon_insert" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_select_scoped" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_insert_scoped" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_update_scoped" ON %I', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_delete_scoped" ON %I', tbl, tbl);

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name='store_id') THEN
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('CREATE POLICY "%s_select_scoped" ON %I FOR SELECT USING (public.user_can_access_store(store_id))', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_insert_scoped" ON %I FOR INSERT WITH CHECK (public.user_can_access_store(store_id))', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_update_scoped" ON %I FOR UPDATE USING (public.user_can_access_store(store_id))', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_delete_scoped" ON %I FOR DELETE USING (public.user_can_access_store(store_id))', tbl, tbl);
      END IF;
    END IF;
  END LOOP;
END $$;