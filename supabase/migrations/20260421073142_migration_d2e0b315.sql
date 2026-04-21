-- webhook_events: drop public policies; keep scoped
DROP POLICY IF EXISTS public_read_webhook_events ON webhook_events;
DROP POLICY IF EXISTS public_insert_webhook_events ON webhook_events;
DROP POLICY IF EXISTS public_update_webhook_events ON webhook_events;

-- webhooks: drop public, add scoped
DROP POLICY IF EXISTS public_select_webhooks ON webhooks;
DROP POLICY IF EXISTS public_insert_webhooks ON webhooks;
DROP POLICY IF EXISTS public_update_webhooks ON webhooks;
DROP POLICY IF EXISTS public_delete_webhooks ON webhooks;
CREATE POLICY webhooks_select_scoped ON webhooks FOR SELECT USING (user_can_access_store(store_id));
CREATE POLICY webhooks_insert_scoped ON webhooks FOR INSERT WITH CHECK (user_can_access_store(store_id));
CREATE POLICY webhooks_update_scoped ON webhooks FOR UPDATE USING (user_can_access_store(store_id));
CREATE POLICY webhooks_delete_scoped ON webhooks FOR DELETE USING (user_can_access_store(store_id));

-- entity_changes
DROP POLICY IF EXISTS entity_changes_select ON entity_changes;
DROP POLICY IF EXISTS entity_changes_insert ON entity_changes;
CREATE POLICY entity_changes_select_scoped ON entity_changes FOR SELECT USING (user_can_access_store(store_id));
CREATE POLICY entity_changes_insert_scoped ON entity_changes FOR INSERT WITH CHECK (user_can_access_store(store_id));

-- deleted_records
DROP POLICY IF EXISTS anon_select_deleted ON deleted_records;
DROP POLICY IF EXISTS anon_insert_deleted ON deleted_records;
CREATE POLICY deleted_records_select_scoped ON deleted_records FOR SELECT USING (user_can_access_store(store_id));
CREATE POLICY deleted_records_insert_scoped ON deleted_records FOR INSERT WITH CHECK (user_can_access_store(store_id));

-- cron_logs: scope by store when present
DROP POLICY IF EXISTS public_select_cron_logs ON cron_logs;
CREATE POLICY cron_logs_select_scoped ON cron_logs FOR SELECT USING (store_id IS NULL OR user_can_access_store(store_id));

-- products / orders / customers: drop public shadow policies (scoped already exist)
DROP POLICY IF EXISTS public_read_products ON products;
DROP POLICY IF EXISTS public_insert_products ON products;
DROP POLICY IF EXISTS public_update_products ON products;
DROP POLICY IF EXISTS public_read_orders ON orders;
DROP POLICY IF EXISTS public_insert_orders ON orders;
DROP POLICY IF EXISTS public_update_orders ON orders;
DROP POLICY IF EXISTS public_read_customers ON customers;
DROP POLICY IF EXISTS public_insert_customers ON customers;
DROP POLICY IF EXISTS public_update_customers ON customers;

-- categories / tags / coupons: drop duplicated public
DROP POLICY IF EXISTS categories_select ON categories;
DROP POLICY IF EXISTS categories_insert ON categories;
DROP POLICY IF EXISTS categories_update ON categories;
DROP POLICY IF EXISTS categories_delete ON categories;
DROP POLICY IF EXISTS tags_auth_write ON tags;
DROP POLICY IF EXISTS tags_auth_update ON tags;
DROP POLICY IF EXISTS tags_auth_delete ON tags;
DROP POLICY IF EXISTS coupons_select ON coupons;
DROP POLICY IF EXISTS coupons_insert ON coupons;
DROP POLICY IF EXISTS coupons_update ON coupons;
DROP POLICY IF EXISTS coupons_delete ON coupons;