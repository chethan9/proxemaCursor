-- =============================================================================
-- PERF REPAIR MIGRATION
-- Run this in Supabase SQL Editor on the NEW prod project (dhttgkwttmqxacixhmfg)
-- Safe to re-run: all CREATE INDEX statements use IF NOT EXISTS
-- =============================================================================

-- ---------- PART 1: BEFORE REPORT --------------------------------------------
SELECT '=== TABLE SIZES + DEAD TUPLES (before) ===' AS section;
SELECT
  schemaname, relname AS table,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  last_analyze, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC NULLS LAST;

SELECT '=== EXISTING INDEXES (before) ===' AS section;
SELECT tablename, COUNT(*) AS index_count
FROM pg_indexes WHERE schemaname = 'public'
GROUP BY tablename ORDER BY tablename;

-- ---------- PART 2: FK INDEXES -----------------------------------------------
-- Core hierarchy
CREATE INDEX IF NOT EXISTS idx_stores_client_id           ON public.stores(client_id);
CREATE INDEX IF NOT EXISTS idx_stores_created_at          ON public.stores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_created_at         ON public.clients(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id         ON public.profiles(client_id);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_store_id          ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_woo_id            ON public.products(store_id, woo_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at        ON public.products(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_status            ON public.products(store_id, status);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_store_id            ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_woo_id              ON public.orders(store_id, woo_id);
CREATE INDEX IF NOT EXISTS idx_orders_status              ON public.orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id         ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at          ON public.orders(store_id, created_at DESC);

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_store_id         ON public.customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_woo_id           ON public.customers(store_id, woo_id);
CREATE INDEX IF NOT EXISTS idx_customers_email            ON public.customers(store_id, email);

-- Taxonomy
CREATE INDEX IF NOT EXISTS idx_categories_store_id        ON public.categories(store_id);
CREATE INDEX IF NOT EXISTS idx_categories_woo_id          ON public.categories(store_id, woo_id);
CREATE INDEX IF NOT EXISTS idx_tags_store_id              ON public.tags(store_id);
CREATE INDEX IF NOT EXISTS idx_tags_woo_id                ON public.tags(store_id, woo_id);

-- Sync + webhooks
CREATE INDEX IF NOT EXISTS idx_sync_runs_store_id         ON public.sync_runs(store_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at       ON public.sync_runs(store_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status           ON public.sync_runs(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_store_id          ON public.webhooks(store_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_store_id    ON public.webhook_events(store_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received    ON public.webhook_events(store_id, received_at DESC);

-- Activity + audit
CREATE INDEX IF NOT EXISTS idx_activity_log_actor         ON public.activity_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity        ON public.activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at    ON public.activity_log(created_at DESC);

-- Billing
CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id    ON public.subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status       ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id         ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at        ON public.invoices(client_id, created_at DESC);

-- API
CREATE INDEX IF NOT EXISTS idx_api_keys_client_id         ON public.api_keys(client_id);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_api_key      ON public.api_call_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_call_logs_created_at   ON public.api_call_logs(created_at DESC);

-- Bulk jobs
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_store_id         ON public.bulk_jobs(store_id);
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_status           ON public.bulk_jobs(status);

-- ---------- PART 3: JSONB FUNCTIONAL INDEXES ---------------------------------
-- Fixes the exact slow query you pasted (order=raw_data->>date_created.desc)
CREATE INDEX IF NOT EXISTS idx_products_raw_date_created
  ON public.products ((raw_data->>'date_created') DESC);
CREATE INDEX IF NOT EXISTS idx_products_raw_date_modified
  ON public.products ((raw_data->>'date_modified') DESC);
CREATE INDEX IF NOT EXISTS idx_orders_raw_date_created
  ON public.orders ((raw_data->>'date_created') DESC);
CREATE INDEX IF NOT EXISTS idx_orders_raw_date_modified
  ON public.orders ((raw_data->>'date_modified') DESC);

-- JSONB GIN (fast contains/search on entire raw_data blob)
CREATE INDEX IF NOT EXISTS idx_products_raw_data_gin
  ON public.products USING gin (raw_data jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_orders_raw_data_gin
  ON public.orders USING gin (raw_data jsonb_path_ops);

-- ---------- PART 4: VACUUM + ANALYZE ALL TABLES ------------------------------
-- Refreshes planner stats so it stops choosing sequential scans.
-- This alone frequently produces a 10x+ speedup on a freshly-restored DB.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname='public'
  LOOP
    EXECUTE format('ANALYZE %I.%I', r.schemaname, r.tablename);
  END LOOP;
END$$;

-- ---------- PART 5: AFTER REPORT ---------------------------------------------
SELECT '=== INDEX COUNTS (after) ===' AS section;
SELECT tablename, COUNT(*) AS index_count
FROM pg_indexes WHERE schemaname = 'public'
GROUP BY tablename ORDER BY tablename;

SELECT '=== PLANNER STATS (after) ===' AS section;
SELECT relname AS table, n_live_tup AS live_rows, last_analyze
FROM pg_stat_user_tables
WHERE schemaname='public' AND n_live_tup > 0
ORDER BY n_live_tup DESC;

SELECT '=== DONE. Reload your app. ===' AS section;