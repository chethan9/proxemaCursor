-- WOO SYNC PRODUCTION SCHEMA
-- Idempotent: safe to run on empty or partial databases.
-- Run this ONCE in your new production Supabase SQL editor.

-- ============================================================
-- STEP 0: Base profiles table (Softgen template baseline)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 0b: Stub helper functions (real versions defined in migrations below)
-- Needed because some early migrations reference these before they're created.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_super_admin() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.current_user_client_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION public.user_can_access_store(p_store_id uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT true $$;

-- ============================================================
-- STEP 1: All project migrations (in order)
-- ============================================================


-- 20260417114533_migration_d6058ba4.sql
-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  consumer_key TEXT,
  consumer_secret TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'error', 'syncing')),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sync_runs table
CREATE TABLE IF NOT EXISTS sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  aspect TEXT NOT NULL CHECK (aspect IN ('products', 'variations', 'categories', 'orders', 'customers', 'coupons', 'all')),
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stores_client_id ON stores(client_id);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
CREATE INDEX IF NOT EXISTS idx_sync_runs_store_id ON sync_runs(store_id);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON sync_runs(status);
CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_store_id ON webhook_events(store_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);

-- Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- T3 policies for MVP (public access, will add auth later)
CREATE POLICY "public_read_clients" ON clients FOR SELECT USING (true);
CREATE POLICY "public_insert_clients" ON clients FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_clients" ON clients FOR UPDATE USING (true);
CREATE POLICY "public_delete_clients" ON clients FOR DELETE USING (true);

CREATE POLICY "public_read_stores" ON stores FOR SELECT USING (true);
CREATE POLICY "public_insert_stores" ON stores FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_stores" ON stores FOR UPDATE USING (true);
CREATE POLICY "public_delete_stores" ON stores FOR DELETE USING (true);

CREATE POLICY "public_read_sync_runs" ON sync_runs FOR SELECT USING (true);
CREATE POLICY "public_insert_sync_runs" ON sync_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_sync_runs" ON sync_runs FOR UPDATE USING (true);
CREATE POLICY "public_delete_sync_runs" ON sync_runs FOR DELETE USING (true);

CREATE POLICY "public_read_webhook_events" ON webhook_events FOR SELECT USING (true);
CREATE POLICY "public_insert_webhook_events" ON webhook_events FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_webhook_events" ON webhook_events FOR UPDATE USING (true);

-- 20260417121840_migration_2c1babcd.sql
-- Create webhooks table to track registered webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  topic VARCHAR(100) NOT NULL,
  woo_webhook_id BIGINT,
  delivery_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'disabled', 'failed')),
  secret VARCHAR(255),
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, topic)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhooks_store_id ON webhooks(store_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);

-- Add processing_status to webhook_events for tracking
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS error_message TEXT;

-- RLS for webhooks
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select_webhooks" ON webhooks FOR SELECT USING (true);
CREATE POLICY "public_insert_webhooks" ON webhooks FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_webhooks" ON webhooks FOR UPDATE USING (true);
CREATE POLICY "public_delete_webhooks" ON webhooks FOR DELETE USING (true);

-- 20260417122351_migration_50fd699c.sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sync_interval integer NULL;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS next_sync_at timestamp with time zone NULL;

-- 20260417122355_migration_f34c0be4.sql
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  sku TEXT,
  price DECIMAL(10,2),
  regular_price DECIMAL(10,2),
  sale_price DECIMAL(10,2),
  stock_quantity INTEGER,
  stock_status TEXT,
  status TEXT,
  type TEXT,
  description TEXT,
  short_description TEXT,
  categories JSONB,
  images JSONB,
  attributes JSONB,
  raw_data JSONB,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(store_id, woo_id)
);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_woo_id ON products(woo_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_products" ON products FOR SELECT USING (true);
CREATE POLICY "public_insert_products" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_products" ON products FOR UPDATE USING (true);

-- 20260417122400_migration_a25738f8.sql
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id BIGINT NOT NULL,
  order_number TEXT,
  status TEXT,
  currency TEXT,
  total DECIMAL(10,2),
  subtotal DECIMAL(10,2),
  total_tax DECIMAL(10,2),
  shipping_total DECIMAL(10,2),
  discount_total DECIMAL(10,2),
  payment_method TEXT,
  payment_method_title TEXT,
  customer_id BIGINT,
  billing JSONB,
  shipping JSONB,
  line_items JSONB,
  shipping_lines JSONB,
  fee_lines JSONB,
  coupon_lines JSONB,
  raw_data JSONB,
  date_created TIMESTAMP WITH TIME ZONE,
  date_modified TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(store_id, woo_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_woo_id ON orders(woo_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date_created ON orders(date_created DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_orders" ON orders FOR SELECT USING (true);
CREATE POLICY "public_insert_orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_orders" ON orders FOR UPDATE USING (true);

-- 20260417122404_migration_2200c133.sql
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id BIGINT NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  role TEXT,
  billing JSONB,
  shipping JSONB,
  is_paying_customer BOOLEAN,
  avatar_url TEXT,
  orders_count INTEGER,
  total_spent DECIMAL(10,2),
  raw_data JSONB,
  date_created TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(store_id, woo_id)
);

CREATE INDEX IF NOT EXISTS idx_customers_store_id ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_woo_id ON customers(woo_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_customers" ON customers FOR SELECT USING (true);
CREATE POLICY "public_insert_customers" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_customers" ON customers FOR UPDATE USING (true);

-- 20260417123058_migration_56274038.sql
-- Create cron_logs table for tracking scheduled job executions
CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL DEFAULT 'sync',
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'started',
  message TEXT,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_cron_logs_store_id ON cron_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_cron_logs_started_at ON cron_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_logs_job_type ON cron_logs(job_type);

-- Enable RLS
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select_cron_logs" ON cron_logs FOR SELECT USING (true);
CREATE POLICY "public_insert_cron_logs" ON cron_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_cron_logs" ON cron_logs FOR UPDATE USING (true);

-- 20260417124613_migration_224855c6.sql
-- Add short_id column to stores for unique display ID
ALTER TABLE stores ADD COLUMN IF NOT EXISTS short_id VARCHAR(8);

-- Generate short IDs for existing stores
UPDATE stores SET short_id = UPPER(SUBSTR(id::text, 1, 8)) WHERE short_id IS NULL;

-- 20260417133814_migration_106f2d0c.sql
-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  parent_id INTEGER,
  description TEXT,
  display TEXT,
  image JSONB,
  menu_order INTEGER DEFAULT 0,
  count INTEGER DEFAULT 0,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, woo_id)
);

-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  amount DECIMAL(10,2),
  discount_type TEXT,
  description TEXT,
  date_expires TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  individual_use BOOLEAN DEFAULT false,
  product_ids JSONB,
  excluded_product_ids JSONB,
  usage_limit INTEGER,
  usage_limit_per_user INTEGER,
  free_shipping BOOLEAN DEFAULT false,
  minimum_amount DECIMAL(10,2),
  maximum_amount DECIMAL(10,2),
  raw_data JSONB,
  date_created TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, woo_id)
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (public read for now)
CREATE POLICY "categories_select" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (true);
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (true);
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (true);

CREATE POLICY "coupons_select" ON coupons FOR SELECT USING (true);
CREATE POLICY "coupons_insert" ON coupons FOR INSERT WITH CHECK (true);
CREATE POLICY "coupons_update" ON coupons FOR UPDATE USING (true);
CREATE POLICY "coupons_delete" ON coupons FOR DELETE USING (true);

-- 20260417213825_migration_79d4abdf.sql
-- Task 7: Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  woo_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  count INTEGER DEFAULT 0,
  raw_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, woo_id)
);
CREATE INDEX IF NOT EXISTS idx_tags_store_id ON tags(store_id);
CREATE INDEX IF NOT EXISTS idx_tags_woo_id ON tags(woo_id);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags_public_read" ON tags FOR SELECT USING (true);
CREATE POLICY "tags_auth_write" ON tags FOR INSERT WITH CHECK (true);
CREATE POLICY "tags_auth_update" ON tags FOR UPDATE USING (true);
CREATE POLICY "tags_auth_delete" ON tags FOR DELETE USING (true);

-- Create api_tokens table
CREATE TABLE IF NOT EXISTS api_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  scopes JSONB DEFAULT '["read"]'::jsonb,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_token ON api_tokens(token);
CREATE INDEX IF NOT EXISTS idx_api_tokens_client_id ON api_tokens(client_id);
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_tokens_read" ON api_tokens FOR SELECT USING (true);
CREATE POLICY "api_tokens_write" ON api_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "api_tokens_update" ON api_tokens FOR UPDATE USING (true);
CREATE POLICY "api_tokens_delete" ON api_tokens FOR DELETE USING (true);

-- Add health columns to stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS health_checked_at TIMESTAMPTZ;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS health_issues JSONB DEFAULT '[]'::jsonb;

-- Create webhook_test_results table
CREATE TABLE IF NOT EXISTS webhook_test_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  test_payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN DEFAULT false,
  tested_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_test_webhook_id ON webhook_test_results(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_test_store_id ON webhook_test_results(store_id);
ALTER TABLE webhook_test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wtr_read" ON webhook_test_results FOR SELECT USING (true);
CREATE POLICY "wtr_write" ON webhook_test_results FOR INSERT WITH CHECK (true);

-- Composite index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_sync_runs_store_status_time 
ON sync_runs(store_id, status, started_at DESC);

-- GIN indexes for JSON search
CREATE INDEX IF NOT EXISTS idx_products_raw_data ON products USING GIN (raw_data);
CREATE INDEX IF NOT EXISTS idx_orders_raw_data ON orders USING GIN (raw_data);

-- 20260417214811_migration_c2db3412.sql
-- Add token_hash column to api_tokens (keep token for backwards compat)
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT UNIQUE;
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS prefix TEXT;
CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON api_tokens(token_hash);

-- Create api_request_logs table
CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_id UUID REFERENCES api_tokens(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT NOT NULL,
  response_time_ms INT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_logs_all" ON api_request_logs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_api_logs_token ON api_request_logs(token_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_client ON api_request_logs(client_id, created_at DESC);

-- Add missing columns to webhook_test_results
ALTER TABLE webhook_test_results ADD COLUMN IF NOT EXISTS duration_ms INT;
ALTER TABLE webhook_test_results ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE webhook_test_results ALTER COLUMN store_id DROP NOT NULL;

-- 20260417215350_migration_d03aebe0.sql
-- Fix sync_runs aspect check to include 'tags'
ALTER TABLE sync_runs DROP CONSTRAINT IF EXISTS sync_runs_aspect_check;
ALTER TABLE sync_runs ADD CONSTRAINT sync_runs_aspect_check CHECK (aspect IN ('products', 'variations', 'categories', 'orders', 'customers', 'coupons', 'tags', 'all'));

-- 20260417225337_migration_70f8cc1d.sql
CREATE TABLE entity_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  woo_id bigint NULL,
  entity_name text NULL,
  change_type text NOT NULL,
  changed_fields jsonb NULL DEFAULT '[]'::jsonb,
  snapshot_before jsonb NULL,
  snapshot_after jsonb NULL,
  source text NOT NULL DEFAULT 'webhook',
  created_at timestamptz NULL DEFAULT now()
);

CREATE INDEX idx_entity_changes_store ON entity_changes(store_id);
CREATE INDEX idx_entity_changes_entity ON entity_changes(entity_type, entity_id);
CREATE INDEX idx_entity_changes_woo ON entity_changes(store_id, entity_type, woo_id);
CREATE INDEX idx_entity_changes_created ON entity_changes(created_at DESC);

ALTER TABLE entity_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entity_changes_select" ON entity_changes FOR SELECT USING (true);
CREATE POLICY "entity_changes_insert" ON entity_changes FOR INSERT WITH CHECK (true);

COMMENT ON TABLE entity_changes IS 'Tracks all field-level changes to synced WooCommerce entities';
COMMENT ON COLUMN entity_changes.change_type IS 'created, updated, deleted, status_change';
COMMENT ON COLUMN entity_changes.changed_fields IS 'Array of {field, old, new} objects';
COMMENT ON COLUMN entity_changes.source IS 'webhook, sync, manual';

-- 20260417233355_migration_3698a728.sql
CREATE TABLE deleted_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  woo_id bigint,
  entity_name text,
  deleted_at timestamptz DEFAULT now(),
  snapshot jsonb,
  source text DEFAULT 'webhook',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_deleted_records_store ON deleted_records(store_id);
CREATE INDEX idx_deleted_records_type ON deleted_records(store_id, entity_type);

ALTER TABLE deleted_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_select_deleted" ON deleted_records FOR SELECT USING (true);
CREATE POLICY "anon_insert_deleted" ON deleted_records FOR INSERT WITH CHECK (true);

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  scopes text[] DEFAULT '{read}',
  rate_limit int DEFAULT 1000,
  allowed_origins text[],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_client ON api_keys(client_id);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_api_keys" ON api_keys FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE api_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  method text,
  path text,
  status_code int,
  response_time_ms int,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_api_call_logs_key ON api_call_logs(api_key_id);
CREATE INDEX idx_api_call_logs_created ON api_call_logs(created_at DESC);

ALTER TABLE api_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_api_logs" ON api_call_logs FOR ALL USING (true) WITH CHECK (true);

-- 20260418012824_migration_5911043b.sql
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  brand_name TEXT DEFAULT 'WooSync',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#008060',
  sidebar_color TEXT DEFAULT '#1a1a1a',
  accent_color TEXT DEFAULT '#008060',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "public_write_settings" ON app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_settings" ON app_settings FOR UPDATE USING (true);
INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

-- 20260418013725_migration_9f28c8d8.sql
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "branding_public_read" ON storage.objects;
DROP POLICY IF EXISTS "branding_public_write" ON storage.objects;
DROP POLICY IF EXISTS "branding_public_update" ON storage.objects;
DROP POLICY IF EXISTS "branding_public_delete" ON storage.objects;
CREATE POLICY "branding_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "branding_public_write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'branding');
CREATE POLICY "branding_public_update" ON storage.objects FOR UPDATE USING (bucket_id = 'branding');
CREATE POLICY "branding_public_delete" ON storage.objects FOR DELETE USING (bucket_id = 'branding');

-- 20260418021019_migration_ba6befe1.sql
-- Clear existing data per user approval
TRUNCATE TABLE 
  webhook_events, sync_runs, entity_changes, categories, coupons, 
  deleted_records, webhooks, api_keys, api_call_logs, products, tags, 
  api_tokens, orders, webhook_test_results, customers, cron_logs, 
  api_request_logs, stores, clients
RESTART IDENTITY CASCADE;

-- Extend profiles with role, client_id, is_active
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON profiles(client_id);

-- Roles table with JSON permissions
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed system roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
  ('super_admin', 'Full system access including user and role management', '["*"]'::jsonb, true),
  ('admin', 'Manage clients, sites, and users (no system settings)', '["clients.view","clients.manage","sites.view","sites.manage","sync.view","sync.trigger","webhooks.view","webhooks.manage","data.view","api.view","api.manage","users.view","users.manage"]'::jsonb, true),
  ('user', 'Standard user - manage own client sites', '["sites.view","sync.view","sync.trigger","webhooks.view","webhooks.manage","data.view","api.view","api.manage"]'::jsonb, true)
ON CONFLICT (name) DO UPDATE SET 
  permissions = EXCLUDED.permissions, 
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- 20260418021047_migration_5ead5615.sql
-- Helper functions (SECURITY DEFINER to bypass RLS safely)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.current_user_client_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT client_id FROM profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(perm text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  user_role text;
  role_perms jsonb;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid() AND is_active = true;
  IF user_role IS NULL THEN RETURN false; END IF;
  SELECT permissions INTO role_perms FROM roles WHERE name = user_role;
  IF role_perms IS NULL THEN RETURN false; END IF;
  RETURN role_perms ? '*' OR role_perms ? perm;
END;
$$;

-- Bootstrap: only allows creating first super admin when none exist
CREATE OR REPLACE FUNCTION public.can_bootstrap_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin' AND is_active = true);
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Super admin already exists - bootstrap disabled';
  END IF;
  UPDATE profiles SET role = 'super_admin', is_active = true WHERE id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO profiles (id, email, role, is_active)
    SELECT id, email, 'super_admin', true FROM auth.users WHERE id = auth.uid();
  END IF;
END;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, is_active) 
  VALUES (NEW.id, NEW.email, 'user', true) 
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 20260418021100_core_functions.sql
-- Core function definitions needed by triggers that follow. Uses CREATE OR REPLACE so safe to rerun.

CREATE OR REPLACE FUNCTION public.auto_create_client_for_profile()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  new_client_id uuid;
  client_name text;
BEGIN
  IF NEW.role = 'super_admin' OR NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  client_name := COALESCE(NULLIF(NEW.full_name, ''), split_part(NEW.email, '@', 1));
  INSERT INTO public.clients (name) VALUES (client_name) RETURNING id INTO new_client_id;
  NEW.client_id := new_client_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Super admin already exists - bootstrap disabled';
  END IF;
  UPDATE profiles SET role = 'super_admin', is_active = true WHERE id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO profiles (id, email, role, is_active)
    SELECT id, email, 'super_admin', true FROM auth.users WHERE id = auth.uid();
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_bootstrap_super_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin' AND is_active = true);
$function$;

CREATE OR REPLACE FUNCTION public.current_user_client_id()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role, is_active)
  VALUES (NEW.id, NEW.email, 'user', true)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(perm text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  role_perms jsonb;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid() AND is_active = true;
  IF user_role IS NULL THEN RETURN false; END IF;
  SELECT permissions INTO role_perms FROM roles WHERE name = user_role;
  IF role_perms IS NULL THEN RETURN false; END IF;
  RETURN role_perms ? '*' OR role_perms ? perm;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_api_call_count(p_client_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE subscriptions
  SET api_calls_this_period = api_calls_this_period + 1
  WHERE client_id = p_client_id
    AND status IN ('trialing', 'active', 'past_due');
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.log_branding_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  actor_email text;
BEGIN
  SELECT email INTO actor_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.branding_audit_log (
      changed_by, changed_by_email,
      new_brand_name, new_logo_url, new_theme_preset, new_primary_color
    ) VALUES (
      auth.uid(), actor_email,
      NEW.brand_name, NEW.logo_url, NEW.theme_preset, NEW.primary_color
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.brand_name IS DISTINCT FROM NEW.brand_name
       OR OLD.logo_url IS DISTINCT FROM NEW.logo_url
       OR OLD.theme_preset IS DISTINCT FROM NEW.theme_preset
       OR OLD.primary_color IS DISTINCT FROM NEW.primary_color THEN
      INSERT INTO public.branding_audit_log (
        changed_by, changed_by_email,
        previous_brand_name, new_brand_name,
        previous_logo_url, new_logo_url,
        previous_theme_preset, new_theme_preset,
        previous_primary_color, new_primary_color
      ) VALUES (
        auth.uid(), actor_email,
        OLD.brand_name, NEW.brand_name,
        OLD.logo_url, NEW.logo_url,
        OLD.theme_preset, NEW.theme_preset,
        OLD.primary_color, NEW.primary_color
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_change_generic()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_email text;
  v_entity_id text;
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
BEGIN
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    v_entity_id := to_jsonb(NEW) ->> 'id';
    v_diff := jsonb_build_object('after', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := to_jsonb(NEW) ->> 'id';
    SELECT jsonb_object_agg(key, value) INTO v_before FROM jsonb_each(to_jsonb(OLD)) WHERE value IS DISTINCT FROM (to_jsonb(NEW) -> key);
    SELECT jsonb_object_agg(key, value) INTO v_after FROM jsonb_each(to_jsonb(NEW)) WHERE value IS DISTINCT FROM (to_jsonb(OLD) -> key);
    IF v_before IS NULL OR v_before = '{}'::jsonb THEN RETURN NEW; END IF;
    v_diff := jsonb_build_object('before', v_before, 'after', v_after);
  ELSIF TG_OP = 'DELETE' THEN
    v_entity_id := to_jsonb(OLD) ->> 'id';
    v_diff := jsonb_build_object('before', to_jsonb(OLD));
  END IF;
  INSERT INTO public.activity_log (actor_user_id, actor_email, actor_type, action, entity_type, entity_id, diff)
  VALUES (auth.uid(), v_actor_email, CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END, TG_TABLE_NAME || '.' || lower(TG_OP), TG_TABLE_NAME, v_entity_id, v_diff);
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_profile_role_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_email text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role IS NOT DISTINCT FROM NEW.role THEN RETURN NEW; END IF;
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.activity_log (actor_user_id, actor_email, actor_type, action, entity_type, entity_id, diff)
  VALUES (auth.uid(), v_actor_email, CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END,
    CASE WHEN TG_OP = 'INSERT' THEN 'profile.created' ELSE 'profile.role_changed' END,
    'profile', NEW.id::text,
    jsonb_build_object('before', CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('role', OLD.role) ELSE NULL END, 'after', jsonb_build_object('role', NEW.role)));
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.orders_aggregate_customer_trigger()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.customer_id IS NOT NULL AND OLD.customer_id > 0 THEN
      PERFORM public.recalc_customer_aggregates(OLD.store_id, OLD.customer_id);
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.customer_id IS NOT NULL AND NEW.customer_id > 0 THEN
    PERFORM public.recalc_customer_aggregates(NEW.store_id, NEW.customer_id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id AND OLD.customer_id IS NOT NULL AND OLD.customer_id > 0 THEN
    PERFORM public.recalc_customer_aggregates(OLD.store_id, OLD.customer_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_customer_aggregates(p_store_id uuid, p_customer_woo_id bigint)
 RETURNS void LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.customers c
  SET orders_count = COALESCE(agg.cnt, 0), total_spent = COALESCE(agg.spent, 0)
  FROM (SELECT COUNT(*) AS cnt, SUM(CASE WHEN status IN ('completed','processing','on-hold') THEN total::numeric ELSE 0 END) AS spent
        FROM public.orders WHERE store_id = p_store_id AND customer_id = p_customer_woo_id) agg
  WHERE c.store_id = p_store_id AND c.woo_id = p_customer_woo_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
 RETURNS trigger LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_can_access_store(p_store_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.stores s WHERE s.id = p_store_id
    AND (s.client_id IS NULL OR s.client_id = public.current_user_client_id())
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_site_home_stats(p_store_id uuid, p_tz text DEFAULT 'UTC'::text)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  v_today_start timestamptz;
  v_week_start timestamptz;
  v_month_start timestamptz;
  v_result jsonb;
  v_stats jsonb;
  v_daily jsonb;
  v_status jsonb;
  v_recent jsonb;
  v_top jsonb;
  v_revenue_statuses text[] := ARRAY['completed','processing'];
BEGIN
  v_today_start := date_trunc('day', (now() AT TIME ZONE p_tz)) AT TIME ZONE p_tz;
  v_week_start := v_today_start - interval '6 days';
  v_month_start := v_today_start - interval '29 days';
  SELECT jsonb_build_object(
    'orders_today', COUNT(*) FILTER (WHERE date_created >= v_today_start AND status = ANY(v_revenue_statuses)),
    'orders_in_progress', COUNT(*) FILTER (WHERE status IN ('pending','processing','on-hold')),
    'sales_today', COALESCE(SUM(CASE WHEN date_created >= v_today_start AND status = ANY(v_revenue_statuses) THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'sales_week', COALESCE(SUM(CASE WHEN date_created >= v_week_start AND status = ANY(v_revenue_statuses) THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'sales_month', COALESCE(SUM(CASE WHEN date_created >= v_month_start AND status = ANY(v_revenue_statuses) THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'orders_month_count', COUNT(*) FILTER (WHERE date_created >= v_month_start AND status = ANY(v_revenue_statuses)),
    'sales_prev_month', COALESCE(SUM(CASE WHEN date_created >= v_month_start - interval '30 days' AND date_created < v_month_start AND status = ANY(v_revenue_statuses) THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'orders_total', COUNT(*) FILTER (WHERE status = ANY(v_revenue_statuses))
  ) INTO v_stats FROM orders WHERE store_id = p_store_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', day, 'orders', order_count, 'revenue', revenue) ORDER BY day), '[]'::jsonb) INTO v_daily
  FROM (SELECT to_char(d::date, 'YYYY-MM-DD') AS day, COUNT(o.id) AS order_count,
      COALESCE(SUM(COALESCE(o.total::numeric, 0) - COALESCE(o.total_tax::numeric, 0) - COALESCE(o.shipping_total::numeric, 0)), 0) AS revenue
    FROM generate_series(v_month_start, v_today_start, interval '1 day') d
    LEFT JOIN orders o ON o.store_id = p_store_id AND o.date_created >= d AND o.date_created < d + interval '1 day' AND o.status = ANY(v_revenue_statuses)
    GROUP BY d) s;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('status', status, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb) INTO v_status
  FROM (SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS cnt FROM orders WHERE store_id = p_store_id AND date_created >= v_month_start GROUP BY status) s;
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.date_created DESC), '[]'::jsonb) INTO v_recent
  FROM (SELECT id, woo_id, order_number, status, total, currency, date_created, line_items, billing FROM orders WHERE store_id = p_store_id ORDER BY date_created DESC NULLS LAST LIMIT 10) r;
  WITH items AS (
    SELECT (li->>'product_id')::bigint AS product_id, li->>'name' AS name, COALESCE((li->>'quantity')::int, 0) AS qty, COALESCE((li->>'total')::numeric, 0) AS revenue
    FROM orders o, jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) li
    WHERE o.store_id = p_store_id AND o.date_created >= v_month_start AND o.status = ANY(v_revenue_statuses) AND li->>'product_id' IS NOT NULL),
  agg AS (SELECT product_id, MAX(name) AS name, SUM(qty) AS units, SUM(revenue) AS revenue FROM items GROUP BY product_id ORDER BY revenue DESC NULLS LAST LIMIT 10)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', a.product_id, 'name', a.name, 'units', a.units, 'revenue', a.revenue,
    'image', (SELECT (p.images->0->>'src') FROM products p WHERE p.store_id = p_store_id AND p.woo_id = a.product_id LIMIT 1),
    'local_id', (SELECT p.id::text FROM products p WHERE p.store_id = p_store_id AND p.woo_id = a.product_id LIMIT 1))), '[]'::jsonb) INTO v_top FROM agg a;
  v_result := jsonb_build_object('stats', v_stats, 'daily', v_daily, 'status_breakdown', v_status, 'recent_orders', v_recent, 'top_products', v_top);
  RETURN v_result;
END;
$function$;

-- 20260418021110_migration_811f7985.sql
-- Profiles RLS
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_all_super" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_super" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_select_super" ON profiles FOR SELECT USING (is_super_admin());
CREATE POLICY "profiles_update_own_limited" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_update_super" ON profiles FOR UPDATE USING (is_super_admin());
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Roles RLS (super admins manage, everyone reads)
DROP POLICY IF EXISTS "roles_read_all" ON roles;
DROP POLICY IF EXISTS "roles_write_super" ON roles;
CREATE POLICY "roles_read_authenticated" ON roles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "roles_insert_super" ON roles FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "roles_update_super" ON roles FOR UPDATE USING (is_super_admin() AND is_system = false);
CREATE POLICY "roles_delete_super" ON roles FOR DELETE USING (is_super_admin() AND is_system = false);

-- Clients: super sees all, users see their own client
DROP POLICY IF EXISTS "clients_public_read" ON clients;
DROP POLICY IF EXISTS "clients_anon_insert" ON clients;
DROP POLICY IF EXISTS "clients_public_write" ON clients;
CREATE POLICY "clients_select_scoped" ON clients FOR SELECT USING (is_super_admin() OR id = current_user_client_id());
CREATE POLICY "clients_insert_super" ON clients FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clients_update_scoped" ON clients FOR UPDATE USING (is_super_admin() OR id = current_user_client_id());
CREATE POLICY "clients_delete_super" ON clients FOR DELETE USING (is_super_admin());

-- Stores: scoped by client
DROP POLICY IF EXISTS "stores_public_read" ON stores;
DROP POLICY IF EXISTS "stores_public_write" ON stores;
DROP POLICY IF EXISTS "stores_anon_insert" ON stores;
CREATE POLICY "stores_select_scoped" ON stores FOR SELECT USING (is_super_admin() OR client_id = current_user_client_id());
CREATE POLICY "stores_insert_scoped" ON stores FOR INSERT WITH CHECK (is_super_admin() OR client_id = current_user_client_id());
CREATE POLICY "stores_update_scoped" ON stores FOR UPDATE USING (is_super_admin() OR client_id = current_user_client_id());
CREATE POLICY "stores_delete_scoped" ON stores FOR DELETE USING (is_super_admin() OR client_id = current_user_client_id());

-- 20260418021423_migration_40731946.sql
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

-- 20260418023152_migration_b0d4cc76.sql
DROP POLICY IF EXISTS "public_read_stores" ON stores;
DROP POLICY IF EXISTS "public_insert_stores" ON stores;
DROP POLICY IF EXISTS "public_update_stores" ON stores;
DROP POLICY IF EXISTS "public_delete_stores" ON stores;

DROP POLICY IF EXISTS "public_read_clients" ON clients;
DROP POLICY IF EXISTS "public_insert_clients" ON clients;
DROP POLICY IF EXISTS "public_update_clients" ON clients;
DROP POLICY IF EXISTS "public_delete_clients" ON clients;

SELECT p.id, p.email, p.role, p.client_id FROM profiles p;

-- 20260418024827_migration_dbf7afa9.sql
-- Recreate helpers as SECURITY DEFINER to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_client_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_store(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = p_store_id
    AND (s.client_id IS NULL OR s.client_id = public.current_user_client_id())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_client_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_store(uuid) TO authenticated, anon;

-- Simplify profiles RLS to avoid recursion
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid() OR public.is_super_admin());

-- 20260418025555_migration_55c3d228.sql
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "profiles_select_scoped" ON profiles;
DROP POLICY IF EXISTS "profiles_update_scoped" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_scoped" ON profiles;

CREATE POLICY "profiles_select_all_auth" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own_or_admin" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_super_admin()) WITH CHECK (id = auth.uid() OR public.is_super_admin());

-- 20260418025632_migration_d9ce9424.sql
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "select_own" ON profiles;
DROP POLICY IF EXISTS "insert_own" ON profiles;
DROP POLICY IF EXISTS "update_own" ON profiles;
DROP POLICY IF EXISTS "delete_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "profiles_select_scoped" ON profiles;
DROP POLICY IF EXISTS "profiles_update_scoped" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_scoped" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_scoped" ON profiles;

CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (id = auth.uid() OR public.is_super_admin() OR client_id = public.current_user_client_id());
CREATE POLICY "profiles_write" ON profiles FOR UPDATE USING (id = auth.uid() OR public.is_super_admin()) WITH CHECK (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "profiles_create" ON profiles FOR INSERT WITH CHECK (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "profiles_remove" ON profiles FOR DELETE USING (public.is_super_admin());

-- 20260418025726_migration_f825d1d0.sql
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_read" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "profiles_remove" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $func$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$func$;

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid() OR public.is_super_admin()) WITH CHECK (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (public.is_super_admin());

-- 20260418025803_migration_51a6cec5.sql
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "profiles_create" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_select_all_auth" ON profiles;
DROP POLICY IF EXISTS "profiles_select_super" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own_limited" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_super" ON profiles;
DROP POLICY IF EXISTS "profiles_write" ON profiles;

CREATE POLICY "p_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "p_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "p_update" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_super_admin()) WITH CHECK (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "p_delete" ON profiles FOR DELETE TO authenticated USING (public.is_super_admin());

-- 20260418040024_migration_ddedd249.sql
CREATE OR REPLACE FUNCTION public.auto_create_client_for_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_client_id uuid;
  display_name text;
BEGIN
  IF NEW.role = 'super_admin' OR NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  display_name := COALESCE(NULLIF(NEW.full_name, ''), split_part(NEW.email, '@', 1), 'My Workspace');

  INSERT INTO public.clients (name, slug)
  VALUES (display_name, lower(regexp_replace(display_name || '-' || substr(NEW.id::text, 1, 8), '[^a-z0-9]+', '-', 'g')))
  RETURNING id INTO new_client_id;

  NEW.client_id := new_client_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_client ON public.profiles;
CREATE TRIGGER trg_auto_create_client
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_client_for_profile();

-- 20260418040136_migration_4dadf8c9.sql
CREATE OR REPLACE FUNCTION public.auto_create_client_for_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_client_id uuid;
  client_name text;
BEGIN
  IF NEW.role = 'super_admin' OR NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  client_name := COALESCE(NULLIF(NEW.full_name, ''), split_part(NEW.email, '@', 1));
  INSERT INTO public.clients (name) VALUES (client_name) RETURNING id INTO new_client_id;
  NEW.client_id := new_client_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_auto_client ON public.profiles;
CREATE TRIGGER on_profile_created_auto_client
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_client_for_profile();

-- 20260418085006_migration_5614d470.sql
ALTER TABLE entity_changes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';
ALTER TABLE entity_changes ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE entity_changes ADD COLUMN IF NOT EXISTS retry_payload JSONB;
CREATE INDEX IF NOT EXISTS idx_entity_changes_status ON entity_changes(store_id, status) WHERE status = 'failed';

-- 20260418093157_migration_6ce0c3d6.sql
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_read_all" ON payment_methods FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_super_admin_insert" ON payment_methods FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "pm_super_admin_update" ON payment_methods FOR UPDATE USING (is_super_admin());
CREATE POLICY "pm_super_admin_delete" ON payment_methods FOR DELETE USING (is_super_admin());

CREATE INDEX IF NOT EXISTS idx_payment_methods_key ON payment_methods(key);

-- 20260418094225_migration_a31b1e67.sql
CREATE TABLE IF NOT EXISTS user_view_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  view_key TEXT NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, view_key)
);
ALTER TABLE user_view_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON user_view_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON user_view_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON user_view_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON user_view_preferences FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_uvp_user_view ON user_view_preferences(user_id, view_key);

-- 20260418100900_migration_b816b543.sql
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS theme_preset TEXT DEFAULT 'classic';

-- 20260418115323_migration_ebd4bfb6.sql
CREATE TABLE IF NOT EXISTS menu_configs (
  role TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE menu_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all_authenticated_read" ON menu_configs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "super_admin_write" ON menu_configs
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- 20260419004225_migration_80a2cc2d.sql
CREATE TABLE public.bulk_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  total integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  succeeded integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bulk_jobs_status_check CHECK (status IN ('pending','running','completed','failed','cancelled')),
  CONSTRAINT bulk_jobs_job_type_check CHECK (job_type IN (
    'update_order_status','delete_orders',
    'update_product_price','update_product_stock','update_product_status','assign_product_categories','delete_products'
  ))
);

CREATE INDEX idx_bulk_jobs_status_created ON public.bulk_jobs (status, created_at);
CREATE INDEX idx_bulk_jobs_store_created ON public.bulk_jobs (store_id, created_at DESC);
CREATE INDEX idx_bulk_jobs_user ON public.bulk_jobs (user_id, created_at DESC);

ALTER TABLE public.bulk_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY bulk_jobs_select_scoped ON public.bulk_jobs FOR SELECT USING (user_can_access_store(store_id));
CREATE POLICY bulk_jobs_insert_scoped ON public.bulk_jobs FOR INSERT WITH CHECK (user_can_access_store(store_id));
CREATE POLICY bulk_jobs_update_scoped ON public.bulk_jobs FOR UPDATE USING (user_can_access_store(store_id));
CREATE POLICY bulk_jobs_delete_scoped ON public.bulk_jobs FOR DELETE USING (user_can_access_store(store_id));

-- 20260419005124_migration_6bae789a.sql
ALTER TABLE public.bulk_jobs ADD COLUMN IF NOT EXISTS error_message text;

-- 20260419100921_migration_b0467772.sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_landing_path text;

-- 20260419132816_migration_3d1c7031.sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS wp_username text, ADD COLUMN IF NOT EXISTS wp_app_password text;

-- 20260419143145_migration_cec7a86e.sql
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS is_initial boolean DEFAULT false, ADD COLUMN IF NOT EXISTS estimated_total integer DEFAULT 0, ADD COLUMN IF NOT EXISTS processed_total integer DEFAULT 0;

-- 20260419172301_migration_c8370026.sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS logo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-logos', 'site-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "site-logos public read" ON storage.objects;
CREATE POLICY "site-logos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-logos');

DROP POLICY IF EXISTS "site-logos auth upload" ON storage.objects;
CREATE POLICY "site-logos auth upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'site-logos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "site-logos auth update" ON storage.objects;
CREATE POLICY "site-logos auth update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'site-logos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "site-logos auth delete" ON storage.objects;
CREATE POLICY "site-logos auth delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'site-logos' AND auth.uid() IS NOT NULL);

-- 20260419222819_migration_1586d626.sql
CREATE TABLE IF NOT EXISTS public.sync_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  aspect text NOT NULL,
  record_count integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  is_initial boolean NOT NULL DEFAULT false,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sync_benchmarks_store ON public.sync_benchmarks(store_id);
CREATE INDEX IF NOT EXISTS idx_sync_benchmarks_aspect ON public.sync_benchmarks(aspect);
ALTER TABLE public.sync_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bench_select" ON public.sync_benchmarks FOR SELECT USING (true);
CREATE POLICY "bench_insert" ON public.sync_benchmarks FOR INSERT WITH CHECK (true);

-- 20260419235634_migration_f8870698.sql
ALTER TABLE sync_runs DROP CONSTRAINT IF EXISTS sync_runs_status_check;
ALTER TABLE sync_runs ADD CONSTRAINT sync_runs_status_check CHECK (status IN ('running', 'completed', 'failed', 'cancelled'));

UPDATE sync_runs
SET status = 'cancelled', completed_at = NOW(), error_message = 'Cleanup: stuck run'
WHERE status = 'running'
  AND store_id IN (SELECT id FROM stores WHERE url ILIKE '%todookw%');

DELETE FROM stores WHERE url ILIKE '%todookw%';

-- 20260420003019_migration_54663a90.sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS woo_key_id INTEGER;

-- 20260420004805_migration_238b63fe.sql
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS initial_sync_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS celebration_shown_at TIMESTAMPTZ;

-- 20260420015432_migration_c4cd7a9c.sql
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('celebration','announcement','ad','milestone','info','warning')),
  title text NOT NULL,
  body text,
  cta_label text,
  cta_url text,
  image_url text,
  lottie_url text,
  priority int NOT NULL DEFAULT 50,
  shown_at timestamptz,
  dismissed_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unshown ON public.user_notifications (user_id, shown_at) WHERE shown_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_notifications_broadcast ON public.user_notifications (created_at DESC) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_notifications_created ON public.user_notifications (created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_or_broadcast" ON public.user_notifications
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "update_own" ON public.user_notifications
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "insert_own" ON public.user_notifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- 20260420024019_migration_d9726417.sql
-- Super admin can read/update/delete all notifications
CREATE POLICY "super_admin_select_all_notifications" ON user_notifications FOR SELECT USING (is_super_admin());
CREATE POLICY "super_admin_insert_notifications" ON user_notifications FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "super_admin_update_notifications" ON user_notifications FOR UPDATE USING (is_super_admin());
CREATE POLICY "super_admin_delete_notifications" ON user_notifications FOR DELETE USING (is_super_admin());

-- 20260420080251_migration_7c481793.sql
CREATE TABLE IF NOT EXISTS product_variations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  woo_parent_id bigint NOT NULL,
  woo_id bigint NOT NULL,
  sku text,
  regular_price numeric(10,2),
  sale_price numeric(10,2),
  price numeric(10,2),
  stock_quantity integer,
  stock_status text,
  manage_stock boolean DEFAULT false,
  status text DEFAULT 'publish',
  virtual boolean DEFAULT false,
  downloadable boolean DEFAULT false,
  tax_class text,
  weight text,
  dimensions jsonb DEFAULT '{}'::jsonb,
  description text,
  attributes jsonb DEFAULT '[]'::jsonb,
  image jsonb,
  gallery jsonb DEFAULT '[]'::jsonb,
  menu_order integer DEFAULT 0,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (store_id, woo_id)
);

CREATE INDEX IF NOT EXISTS idx_pv_store_product ON product_variations(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_pv_store_parent ON product_variations(store_id, woo_parent_id);

ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pv_select" ON product_variations FOR SELECT USING (user_can_access_store(store_id));
CREATE POLICY "pv_insert" ON product_variations FOR INSERT WITH CHECK (user_can_access_store(store_id));
CREATE POLICY "pv_update" ON product_variations FOR UPDATE USING (user_can_access_store(store_id));
CREATE POLICY "pv_delete" ON product_variations FOR DELETE USING (user_can_access_store(store_id));

-- 20260420185816_migration_27a0c6f4.sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL;

UPDATE stores s SET onboarding_completed_at = COALESCE(
  s.initial_sync_completed_at,
  (SELECT MIN(started_at) FROM sync_runs WHERE store_id = s.id AND is_initial = true)
)
WHERE s.onboarding_completed_at IS NULL
  AND (s.initial_sync_completed_at IS NOT NULL
       OR EXISTS (SELECT 1 FROM sync_runs WHERE store_id = s.id AND is_initial = true));

CREATE INDEX IF NOT EXISTS idx_stores_onboarding_incomplete ON stores(client_id) WHERE onboarding_completed_at IS NULL;

-- 20260421025407_migration_21915aa5.sql
ALTER TABLE sync_runs
  ADD COLUMN IF NOT EXISTS attempt INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS request_url TEXT,
  ADD COLUMN IF NOT EXISTS request_method TEXT,
  ADD COLUMN IF NOT EXISTS request_params JSONB,
  ADD COLUMN IF NOT EXISTS response_status INT,
  ADD COLUMN IF NOT EXISTS response_body TEXT,
  ADD COLUMN IF NOT EXISTS response_headers JSONB;

ALTER TABLE sync_runs DROP CONSTRAINT IF EXISTS sync_runs_status_check;
ALTER TABLE sync_runs ADD CONSTRAINT sync_runs_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'retrying'));

CREATE INDEX IF NOT EXISTS idx_sync_runs_retry ON sync_runs (status, next_retry_at)
  WHERE status = 'retrying';

-- 20260421073142_migration_d2e0b315.sql
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

-- 20260421134713_migration_af6a7eb4.sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'KWD';

-- 20260421194723_migration_4b932547.sql
DROP TRIGGER IF EXISTS trg_orders_customer_agg ON public.orders; CREATE TRIGGER trg_orders_customer_agg AFTER INSERT OR UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.orders_aggregate_customer_trigger();

-- 20260421235503_migration_6f8fe090.sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS timezone text;

-- 20260421235623_migration_24b13bd0.sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS timezone text;

-- 20260422030500_site_home_stats_rpc.sql
-- Site home dashboard stats RPC
-- Returns aggregated stats, daily trend (30d), status breakdown (30d),
-- 10 most recent orders, and top 10 products by revenue (30d) for a given store.
CREATE OR REPLACE FUNCTION public.get_site_home_stats(p_store_id uuid, p_tz text DEFAULT 'UTC'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today_start timestamptz;
  v_week_start timestamptz;
  v_month_start timestamptz;
  v_result jsonb;
  v_stats jsonb;
  v_daily jsonb;
  v_status jsonb;
  v_recent jsonb;
  v_top jsonb;
  v_revenue_statuses text[] := ARRAY['completed','processing'];
BEGIN
  v_today_start := date_trunc('day', (now() AT TIME ZONE p_tz)) AT TIME ZONE p_tz;
  v_week_start := v_today_start - interval '6 days';
  v_month_start := v_today_start - interval '29 days';

  SELECT jsonb_build_object(
    'orders_today', COUNT(*) FILTER (WHERE date_created >= v_today_start AND status = ANY(v_revenue_statuses)),
    'orders_in_progress', COUNT(*) FILTER (WHERE status IN ('pending','processing','on-hold')),
    'sales_today', COALESCE(SUM(CASE WHEN date_created >= v_today_start AND status = ANY(v_revenue_statuses) THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'sales_week', COALESCE(SUM(CASE WHEN date_created >= v_week_start AND status = ANY(v_revenue_statuses) THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'sales_month', COALESCE(SUM(CASE WHEN date_created >= v_month_start AND status = ANY(v_revenue_statuses) THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'orders_month_count', COUNT(*) FILTER (WHERE date_created >= v_month_start AND status = ANY(v_revenue_statuses)),
    'sales_prev_month', COALESCE(SUM(CASE WHEN date_created >= v_month_start - interval '30 days' AND date_created < v_month_start AND status = ANY(v_revenue_statuses) THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'orders_total', COUNT(*) FILTER (WHERE status = ANY(v_revenue_statuses))
  ) INTO v_stats
  FROM orders
  WHERE store_id = p_store_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', day, 'orders', order_count, 'revenue', revenue) ORDER BY day), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT
      to_char(d::date, 'YYYY-MM-DD') AS day,
      COUNT(o.id) AS order_count,
      COALESCE(SUM(COALESCE(o.total::numeric, 0) - COALESCE(o.total_tax::numeric, 0) - COALESCE(o.shipping_total::numeric, 0)), 0) AS revenue
    FROM generate_series(v_month_start, v_today_start, interval '1 day') d
    LEFT JOIN orders o ON o.store_id = p_store_id
      AND o.date_created >= d AND o.date_created < d + interval '1 day'
      AND o.status = ANY(v_revenue_statuses)
    GROUP BY d
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('status', status, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_status
  FROM (
    SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS cnt
    FROM orders
    WHERE store_id = p_store_id AND date_created >= v_month_start
    GROUP BY status
  ) s;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.date_created DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT id, woo_id, order_number, status, total, currency, date_created, line_items, billing
    FROM orders
    WHERE store_id = p_store_id
    ORDER BY date_created DESC NULLS LAST
    LIMIT 10
  ) r;

  WITH items AS (
    SELECT
      (li->>'product_id')::bigint AS product_id,
      li->>'name' AS name,
      COALESCE((li->>'quantity')::int, 0) AS qty,
      COALESCE((li->>'total')::numeric, 0) AS revenue
    FROM orders o, jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) li
    WHERE o.store_id = p_store_id
      AND o.date_created >= v_month_start
      AND o.status = ANY(v_revenue_statuses)
      AND li->>'product_id' IS NOT NULL
  ),
  agg AS (
    SELECT product_id, MAX(name) AS name, SUM(qty) AS units, SUM(revenue) AS revenue
    FROM items
    GROUP BY product_id
    ORDER BY revenue DESC NULLS LAST
    LIMIT 10
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', a.product_id,
    'name', a.name,
    'units', a.units,
    'revenue', a.revenue,
    'image', (SELECT (p.images->0->>'src') FROM products p WHERE p.store_id = p_store_id AND p.woo_id = a.product_id LIMIT 1),
    'local_id', (SELECT p.id::text FROM products p WHERE p.store_id = p_store_id AND p.woo_id = a.product_id LIMIT 1)
  )), '[]'::jsonb)
  INTO v_top
  FROM agg a;

  v_result := jsonb_build_object(
    'stats', v_stats,
    'daily', v_daily,
    'status_breakdown', v_status,
    'recent_orders', v_recent,
    'top_products', v_top
  );

  RETURN v_result;
END;
$function$;

-- 20260422201543_migration_064dfdb0.sql
ALTER TABLE stores ADD COLUMN IF NOT EXISTS screenshot_url text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS screenshot_captured_at timestamptz;

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-screenshots', 'site-screenshots', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "site_screenshots_public_read" ON storage.objects;
CREATE POLICY "site_screenshots_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'site-screenshots');

DROP POLICY IF EXISTS "site_screenshots_service_write" ON storage.objects;
CREATE POLICY "site_screenshots_service_write" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'site-screenshots') WITH CHECK (bucket_id = 'site-screenshots');

-- 20260422204403_migration_2531d13f.sql
DROP POLICY IF EXISTS public_update_settings ON public.app_settings;
DROP POLICY IF EXISTS public_write_settings ON public.app_settings;

CREATE POLICY app_settings_admin_insert ON public.app_settings
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY app_settings_admin_update ON public.app_settings
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.branding_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email text,
  previous_brand_name text,
  new_brand_name text,
  previous_logo_url text,
  new_logo_url text,
  previous_theme_preset text,
  new_theme_preset text,
  previous_primary_color text,
  new_primary_color text
);

CREATE INDEX IF NOT EXISTS idx_branding_audit_changed_at ON public.branding_audit_log (changed_at DESC);

ALTER TABLE public.branding_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branding_audit_admin_read ON public.branding_audit_log;
CREATE POLICY branding_audit_admin_read ON public.branding_audit_log
  FOR SELECT USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.log_branding_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor_email text;
BEGIN
  SELECT email INTO actor_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.branding_audit_log (
      changed_by, changed_by_email,
      new_brand_name, new_logo_url, new_theme_preset, new_primary_color
    ) VALUES (
      auth.uid(), actor_email,
      NEW.brand_name, NEW.logo_url, NEW.theme_preset, NEW.primary_color
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.brand_name IS DISTINCT FROM NEW.brand_name
       OR OLD.logo_url IS DISTINCT FROM NEW.logo_url
       OR OLD.theme_preset IS DISTINCT FROM NEW.theme_preset
       OR OLD.primary_color IS DISTINCT FROM NEW.primary_color THEN
      INSERT INTO public.branding_audit_log (
        changed_by, changed_by_email,
        previous_brand_name, new_brand_name,
        previous_logo_url, new_logo_url,
        previous_theme_preset, new_theme_preset,
        previous_primary_color, new_primary_color
      ) VALUES (
        auth.uid(), actor_email,
        OLD.brand_name, NEW.brand_name,
        OLD.logo_url, NEW.logo_url,
        OLD.theme_preset, NEW.theme_preset,
        OLD.primary_color, NEW.primary_color
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_app_settings_change ON public.app_settings;
CREATE TRIGGER on_app_settings_change
  AFTER INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_branding_change();

-- 20260422211957_migration_217b9de8.sql
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'admin', 'system', 'api')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  diff jsonb,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON public.activity_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_client ON public.activity_log (client_id, created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_log_admin_read ON public.activity_log;
CREATE POLICY activity_log_admin_read ON public.activity_log
  FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS activity_log_self_read ON public.activity_log;
CREATE POLICY activity_log_self_read ON public.activity_log
  FOR SELECT TO authenticated USING (actor_user_id = auth.uid());

DROP POLICY IF EXISTS activity_log_client_scoped_read ON public.activity_log;
CREATE POLICY activity_log_client_scoped_read ON public.activity_log
  FOR SELECT TO authenticated USING (
    client_id IS NOT NULL AND client_id = public.current_user_client_id()
  );

-- 20260422212034_migration_5bebd89c.sql
CREATE OR REPLACE FUNCTION public.log_change_generic()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_actor_email text;
  v_entity_id text;
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
BEGIN
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_entity_id := to_jsonb(NEW) ->> 'id';
    v_diff := jsonb_build_object('after', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := to_jsonb(NEW) ->> 'id';
    SELECT jsonb_object_agg(key, value) INTO v_before
      FROM jsonb_each(to_jsonb(OLD))
      WHERE value IS DISTINCT FROM (to_jsonb(NEW) -> key);
    SELECT jsonb_object_agg(key, value) INTO v_after
      FROM jsonb_each(to_jsonb(NEW))
      WHERE value IS DISTINCT FROM (to_jsonb(OLD) -> key);
    IF v_before IS NULL OR v_before = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
    v_diff := jsonb_build_object('before', v_before, 'after', v_after);
  ELSIF TG_OP = 'DELETE' THEN
    v_entity_id := to_jsonb(OLD) ->> 'id';
    v_diff := jsonb_build_object('before', to_jsonb(OLD));
  END IF;

  INSERT INTO public.activity_log (
    actor_user_id, actor_email, actor_type,
    action, entity_type, entity_id, diff
  ) VALUES (
    auth.uid(), v_actor_email,
    CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END,
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME, v_entity_id, v_diff
  );

  RETURN COALESCE(NEW, OLD);
END;
$func$;

CREATE OR REPLACE FUNCTION public.log_profile_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
DECLARE
  v_actor_email text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.activity_log (
    actor_user_id, actor_email, actor_type,
    action, entity_type, entity_id, diff
  ) VALUES (
    auth.uid(), v_actor_email,
    CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END,
    CASE WHEN TG_OP = 'INSERT' THEN 'profile.created' ELSE 'profile.role_changed' END,
    'profile', NEW.id::text,
    jsonb_build_object(
      'before', CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('role', OLD.role) ELSE NULL END,
      'after', jsonb_build_object('role', NEW.role)
    )
  );

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS on_profile_role_change ON public.profiles;
CREATE TRIGGER on_profile_role_change
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_profile_role_change();

DROP TRIGGER IF EXISTS on_role_change ON public.roles;
CREATE TRIGGER on_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.log_change_generic();

-- 20260422212157_migration_0692fd35.sql
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_interval text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
  max_sites int NOT NULL DEFAULT 1,
  max_products_per_site int NOT NULL DEFAULT 100,
  max_users int NOT NULL DEFAULT 1,
  max_api_calls_per_month int NOT NULL DEFAULT 10000,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  trial_days int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_custom boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_sort ON public.plans (sort_order, is_active);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_public_read ON public.plans;
CREATE POLICY plans_public_read ON public.plans
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS plans_admin_all ON public.plans;
CREATE POLICY plans_admin_all ON public.plans
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS on_plans_change ON public.plans;
CREATE TRIGGER on_plans_change
  AFTER INSERT OR UPDATE OR DELETE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.log_change_generic();

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS on_plans_touch ON public.plans;
CREATE TRIGGER on_plans_touch
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

INSERT INTO public.plans (slug, name, description, prices, max_sites, max_products_per_site, max_users, max_api_calls_per_month, features, trial_days, is_custom, sort_order) VALUES
  ('starter', 'Starter', 'For solo makers testing the waters',
    '{"USD":900,"INR":79900,"KWD":300,"SAR":3400,"AED":3300}'::jsonb,
    1, 500, 1, 10000,
    '{"priority_support":false,"custom_domain":false,"advanced_webhooks":false}'::jsonb,
    14, false, 10),
  ('growth', 'Growth', 'For growing teams with multiple stores',
    '{"USD":2900,"INR":240000,"KWD":900,"SAR":11000,"AED":11000}'::jsonb,
    3, 5000, 5, 100000,
    '{"priority_support":false,"custom_domain":false,"advanced_webhooks":true}'::jsonb,
    14, false, 20),
  ('scale', 'Scale', 'For agencies running many stores at once',
    '{"USD":9900,"INR":820000,"KWD":3000,"SAR":37000,"AED":36000}'::jsonb,
    10, 25000, 20, 500000,
    '{"priority_support":true,"custom_domain":true,"advanced_webhooks":true}'::jsonb,
    14, false, 30),
  ('enterprise', 'Enterprise', 'Custom pricing, dedicated support, SLA',
    '{}'::jsonb,
    999999, 999999, 999999, 999999,
    '{"priority_support":true,"custom_domain":true,"advanced_webhooks":true,"sla":true,"dedicated_csm":true}'::jsonb,
    0, true, 40)
ON CONFLICT (slug) DO NOTHING;

-- 20260422214005_migration_284135c5.sql
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS country char(2);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'USD';
COMMENT ON COLUMN public.clients.country IS 'ISO 3166-1 alpha-2; drives payment gateway selection (MyFatoorah for ME, Razorpay rest)';
COMMENT ON COLUMN public.clients.currency IS 'ISO 4217; default from country at creation, overridable via profile';

-- 20260422215658_migration_91962dfd.sql
CREATE TYPE public.subscription_status AS ENUM ('pending_payment','trialing','active','past_due','locked','canceled');

-- 20260422215704_migration_12999281.sql
CREATE TYPE public.renewal_mode AS ENUM ('auto','manual');

-- 20260422215710_migration_04102c56.sql
CREATE TYPE public.billing_gateway AS ENUM ('myfatoorah','razorpay');

-- 20260422215735_migration_a498cdc3.sql
CREATE TABLE IF NOT EXISTS public.subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE, plan_id uuid NOT NULL REFERENCES public.plans(id), status subscription_status NOT NULL DEFAULT 'pending_payment', current_period_start timestamptz, current_period_end timestamptz, trial_end timestamptz, cancel_at_period_end boolean NOT NULL DEFAULT false, canceled_at timestamptz, gateway billing_gateway, gateway_subscription_ref text, payment_method_id uuid, currency char(3) NOT NULL DEFAULT 'USD', renewal_mode renewal_mode NOT NULL DEFAULT 'auto', auto_renew_disabled_reason text, last_charge_attempt_at timestamptz, last_charge_failed_at timestamptz, grace_period_days int NOT NULL DEFAULT 7, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- 20260422215740_migration_996f1725.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_client_active ON public.subscriptions (client_id) WHERE status != 'canceled'; CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status); CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON public.subscriptions (current_period_end) WHERE status IN ('active','past_due');

-- 20260422215745_migration_dc37d137.sql
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY; CREATE POLICY subs_client_read ON public.subscriptions FOR SELECT TO authenticated USING (client_id = public.current_user_client_id() OR public.is_super_admin()); CREATE POLICY subs_admin_all ON public.subscriptions FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin()); CREATE TRIGGER on_subscriptions_change AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.log_change_generic();

-- 20260422215755_migration_657a8d91.sql
CREATE TABLE IF NOT EXISTS public.subscription_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE, event_type text NOT NULL, from_status subscription_status, to_status subscription_status, actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, metadata jsonb, created_at timestamptz NOT NULL DEFAULT now()); CREATE INDEX IF NOT EXISTS idx_sub_events_sub ON public.subscription_events (subscription_id, created_at DESC); ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY; CREATE POLICY sub_events_read ON public.subscription_events FOR SELECT TO authenticated USING (subscription_id IN (SELECT id FROM public.subscriptions WHERE client_id = public.current_user_client_id()) OR public.is_super_admin());

-- 20260422220402_migration_de1cbd88.sql
CREATE TABLE IF NOT EXISTS public.client_payment_methods (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE, gateway billing_gateway NOT NULL, gateway_token text NOT NULL, card_brand text, card_last4 text, card_expiry_month int, card_expiry_year int, recurring_eligible boolean NOT NULL DEFAULT false, is_default boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- 20260422220412_migration_987b7779.sql
ALTER TABLE public.client_payment_methods ENABLE ROW LEVEL SECURITY;

-- 20260422220418_migration_205ff14b.sql
CREATE POLICY cpm_client_read ON public.client_payment_methods FOR SELECT TO authenticated USING (client_id = public.current_user_client_id() OR public.is_super_admin());

-- 20260422220423_migration_d4105673.sql
CREATE POLICY cpm_admin_write ON public.client_payment_methods FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 20260422220428_migration_c8c18545.sql
CREATE TRIGGER on_cpm_change AFTER INSERT OR UPDATE OR DELETE ON public.client_payment_methods FOR EACH ROW EXECUTE FUNCTION public.log_change_generic();

-- 20260422220434_migration_cd4b29a8.sql
CREATE INDEX IF NOT EXISTS idx_cpm_client_default ON public.client_payment_methods (client_id, is_default) WHERE is_default = true;

-- 20260423020424_migration_f93ecca7.sql
CREATE TYPE public.coupon_type AS ENUM ('percent','fixed','free_months');

-- 20260423020434_migration_8d3bac8e.sql
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- 20260423020440_migration_aa535554.sql
CREATE POLICY coupons_admin_all ON public.coupons FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 20260423020445_migration_89b79789.sql
CREATE TRIGGER on_coupons_change AFTER INSERT OR UPDATE OR DELETE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.log_change_generic();

-- 20260423020554_migration_30433ae5.sql
DROP INDEX IF EXISTS public.coupons_code_unique;

-- 20260423020559_migration_eea207c8.sql
DROP POLICY IF EXISTS coupons_admin_all ON public.coupons;

-- 20260423020604_migration_7dbf1be7.sql
CREATE TABLE IF NOT EXISTS public.billing_coupons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL, type public.coupon_type NOT NULL, value numeric NOT NULL, currency char(3), plan_ids uuid[], max_redemptions int, redemptions_count int NOT NULL DEFAULT 0, expires_at timestamptz, description text, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());

-- 20260423020614_migration_b5dcdbbf.sql
ALTER TABLE public.billing_coupons ENABLE ROW LEVEL SECURITY;

-- 20260423020618_migration_6475c9bb.sql
CREATE POLICY bc_public_read ON public.billing_coupons FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- 20260423020624_migration_2d9691fb.sql
CREATE POLICY bc_admin_all ON public.billing_coupons FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 20260423020629_migration_44dcd524.sql
CREATE TRIGGER on_billing_coupons_change AFTER INSERT OR UPDATE OR DELETE ON public.billing_coupons FOR EACH ROW EXECUTE FUNCTION public.log_change_generic();

-- 20260423020732_migration_05c02f39.sql
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), coupon_id uuid NOT NULL REFERENCES public.billing_coupons(id) ON DELETE CASCADE, client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE, subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL, discount_minor bigint NOT NULL, currency char(3) NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());

-- 20260423020742_migration_626d4740.sql
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- 20260423020748_migration_20ffb54e.sql
CREATE POLICY cr_client_read ON public.coupon_redemptions FOR SELECT TO authenticated USING (client_id = public.current_user_client_id() OR public.is_super_admin());

-- 20260423020753_migration_5f802f59.sql
CREATE POLICY cr_admin_write ON public.coupon_redemptions FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 20260423020935_migration_f8207ffd.sql
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS pending_coupon_id uuid REFERENCES public.billing_coupons(id) ON DELETE SET NULL;

-- 20260423030000_coupon_function.sql
-- Depends on billing_coupons table created earlier in this batch.

CREATE OR REPLACE FUNCTION public.increment_coupon_redemption_count(coupon_id_in uuid)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  UPDATE public.billing_coupons SET redemptions_count = redemptions_count + 1 WHERE id = coupon_id_in;
$function$;

-- 20260423052250_migration_3c2341c3.sql
CREATE TYPE public.invoice_status AS ENUM ('pending','paid','failed','refunded','void');

-- 20260423052322_migration_eff8cd76.sql
CREATE TABLE IF NOT EXISTS public.invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE, subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL, invoice_number text UNIQUE NOT NULL, amount_minor bigint NOT NULL, currency char(3) NOT NULL, status public.invoice_status NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());

-- 20260423052328_migration_68692ae5.sql
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS period_start timestamptz;

-- 20260423052334_migration_0dde77ef.sql
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS period_end timestamptz;

-- 20260423052339_migration_8da7e940.sql
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS gateway public.billing_gateway;

-- 20260423052344_migration_2af69676.sql
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS gateway_invoice_ref text;

-- 20260423052349_migration_e433209f.sql
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.billing_coupons(id) ON DELETE SET NULL;

-- 20260423052354_migration_205075ce.sql
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_minor bigint NOT NULL DEFAULT 0;

-- 20260423052359_migration_2c5f0c34.sql
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 20260423052444_migration_80175ff2.sql
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 20260423052448_migration_1ea37bb2.sql
CREATE POLICY invoices_client_read ON public.invoices FOR SELECT TO authenticated USING (client_id = public.current_user_client_id() OR public.is_super_admin());

-- 20260423052453_migration_285efcef.sql
CREATE POLICY invoices_admin_write ON public.invoices FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- 20260423052458_migration_305a418d.sql
CREATE TRIGGER on_invoices_change AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.log_change_generic();

-- 20260423052503_migration_c73b41c9.sql
CREATE INDEX IF NOT EXISTS idx_invoices_client_created ON public.invoices (client_id, created_at DESC);

-- 20260423052507_migration_f45a0302.sql
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON public.invoices (subscription_id);

-- 20260423090427_migration_7f19e57a.sql
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS api_calls_this_period integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_api_call_count(p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE subscriptions
  SET api_calls_this_period = api_calls_this_period + 1
  WHERE client_id = p_client_id
    AND status IN ('trialing', 'active', 'past_due');
END;
$$;

GRANT EXECUTE ON FUNCTION increment_api_call_count(uuid) TO authenticated, service_role;

-- =============== DATA ===============

SET session_replication_role = replica;

-- bulk_jobs: 0 rows
-- subscription_events: 0 rows
-- product_variations: 0 rows
-- api_call_logs: 0 rows
-- deleted_records: 0 rows
-- activity_log: 585 rows
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('d2300afc-22bb-4633-bdd7-ac072b1ead74', '2026-04-22T21:21:57.865377+00:00', NULL, NULL, 'system', 'plans.insert', 'plans', '3d4ebeeb-135a-401a-84ad-e65b39fce509', NULL, '{"after":{"id":"3d4ebeeb-135a-401a-84ad-e65b39fce509","name":"Starter","slug":"starter","prices":{"AED":3300,"INR":79900,"KWD":300,"SAR":3400,"USD":900},"features":{"custom_domain":false,"priority_support":false,"advanced_webhooks":false},"is_active":true,"is_custom":false,"max_sites":1,"max_users":1,"created_at":"2026-04-22T21:21:57.865377+00:00","sort_order":10,"trial_days":14,"updated_at":"2026-04-22T21:21:57.865377+00:00","description":"For solo makers testing the waters","billing_interval":"month","max_products_per_site":500,"max_api_calls_per_month":10000}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('5a9750a2-8851-4ea8-afb4-e4ad3d4bf2b7', '2026-04-22T21:21:57.865377+00:00', NULL, NULL, 'system', 'plans.insert', 'plans', '6cd3aa4b-2b1b-481b-8efb-c98be6cf69a0', NULL, '{"after":{"id":"6cd3aa4b-2b1b-481b-8efb-c98be6cf69a0","name":"Growth","slug":"growth","prices":{"AED":11000,"INR":240000,"KWD":900,"SAR":11000,"USD":2900},"features":{"custom_domain":false,"priority_support":false,"advanced_webhooks":true},"is_active":true,"is_custom":false,"max_sites":3,"max_users":5,"created_at":"2026-04-22T21:21:57.865377+00:00","sort_order":20,"trial_days":14,"updated_at":"2026-04-22T21:21:57.865377+00:00","description":"For growing teams with multiple stores","billing_interval":"month","max_products_per_site":5000,"max_api_calls_per_month":100000}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('1cb7b1e4-a1d0-4980-a008-09734e2ca82a', '2026-04-22T21:21:57.865377+00:00', NULL, NULL, 'system', 'plans.insert', 'plans', 'f3604951-57f0-4357-b8ee-c5732ab88a35', NULL, '{"after":{"id":"f3604951-57f0-4357-b8ee-c5732ab88a35","name":"Scale","slug":"scale","prices":{"AED":36000,"INR":820000,"KWD":3000,"SAR":37000,"USD":9900},"features":{"custom_domain":true,"priority_support":true,"advanced_webhooks":true},"is_active":true,"is_custom":false,"max_sites":10,"max_users":20,"created_at":"2026-04-22T21:21:57.865377+00:00","sort_order":30,"trial_days":14,"updated_at":"2026-04-22T21:21:57.865377+00:00","description":"For agencies running many stores at once","billing_interval":"month","max_products_per_site":25000,"max_api_calls_per_month":500000}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('1ead6ac8-8166-4615-a634-92399b403682', '2026-04-22T21:21:57.865377+00:00', NULL, NULL, 'system', 'plans.insert', 'plans', '05e1a60f-c788-458d-b0b2-e00d3cda7a6d', NULL, '{"after":{"id":"05e1a60f-c788-458d-b0b2-e00d3cda7a6d","name":"Enterprise","slug":"enterprise","prices":{},"features":{"sla":true,"custom_domain":true,"dedicated_csm":true,"priority_support":true,"advanced_webhooks":true},"is_active":true,"is_custom":true,"max_sites":999999,"max_users":999999,"created_at":"2026-04-22T21:21:57.865377+00:00","sort_order":40,"trial_days":0,"updated_at":"2026-04-22T21:21:57.865377+00:00","description":"Custom pricing, dedicated support, SLA","billing_interval":"month","max_products_per_site":999999,"max_api_calls_per_month":999999}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('be81ad8d-0a21-4312-9571-2f73445fa623', '2026-04-23T07:04:51.745642+00:00', NULL, NULL, 'system', 'profile.created', 'profile', '4639fed7-01dd-49f7-85dd-54e56111a352', NULL, '{"after":{"role":"user"},"before":null}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('2b0ca0f0-6225-49b2-952f-f2a0493001f0', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '72110464-92d7-4e20-9513-18f35a32c484', NULL, '{"after":{"id":"72110464-92d7-4e20-9513-18f35a32c484","code":"shamiya","amount":25,"woo_id":6464,"raw_data":{"id":6464,"code":"shamiya","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6464","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T15:09:12","date_expires":null,"date_modified":"2026-01-27T15:09:12","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T12:09:12","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T12:09:12","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T15:09:12+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('29543015-eb29-4f53-b6ad-54a628c650e7', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '27e8c77e-cf2f-418f-859d-8149caf679ea', NULL, '{"after":{"id":"27e8c77e-cf2f-418f-859d-8149caf679ea","code":"jhs","amount":29,"woo_id":6463,"raw_data":{"id":6463,"code":"jhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6463","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"29.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:26:33","date_expires":null,"date_modified":"2026-01-27T14:26:33","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T11:26:33","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T11:26:33","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:26:33+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('e70f4de4-95a9-49f9-a95a-07a3c17b801c', '2026-04-23T08:57:17.330017+00:00', '0430a2de-2b6f-4d2f-956f-fb9fa7197259', 'it@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.158.194.159","path":"/api/auth/log-event","email":"it@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('c6bbf7da-8f3a-4510-9c76-c4f6de0eb830', '2026-04-23T09:09:57.786278+00:00', '1bd711f8-2680-47f6-8e50-5bf807e846d8', 'chethan@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.158.194.159","path":"/api/auth/log-event","email":"chethan@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('50e94fd0-a9cf-4401-95e9-26eafb543cd5', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '6c495dca-f7c0-4f35-8d11-7f4497002b59', NULL, '{"after":{"id":"6c495dca-f7c0-4f35-8d11-7f4497002b59","code":"dhs","amount":26,"woo_id":6462,"raw_data":{"id":6462,"code":"dhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6462","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:20:44","date_expires":null,"date_modified":"2026-01-27T14:20:44","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T11:20:44","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T11:20:44","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:20:44+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('f5fbca19-10d1-44df-bef7-dd34d5ad6fd5', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '7693cc68-d76f-4662-a304-333aae9c6de6', NULL, '{"after":{"id":"7693cc68-d76f-4662-a304-333aae9c6de6","code":"yhs","amount":29,"woo_id":6461,"raw_data":{"id":6461,"code":"yhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6461","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"29.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:06:32","date_expires":null,"date_modified":"2026-01-27T14:06:32","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T11:06:32","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T11:06:32","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:06:32+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('dfe0f9e0-1ce0-4414-8f1a-692a4a878a25', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '7e387679-fd9d-424f-bac2-30ee6e6485b4', NULL, '{"after":{"id":"7e387679-fd9d-424f-bac2-30ee6e6485b4","code":"kbs","amount":25,"woo_id":6460,"raw_data":{"id":6460,"code":"kbs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6460","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:59:02","date_expires":null,"date_modified":"2026-01-27T13:59:02","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:59:02","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:59:02","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:59:02+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('ad7e21ac-b219-4f17-922e-f199508b7fa4', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '5dde76f1-fb4a-4bf8-a59c-6108f28b2e6a', NULL, '{"after":{"id":"5dde76f1-fb4a-4bf8-a59c-6108f28b2e6a","code":"2026","amount":22,"woo_id":6459,"raw_data":{"id":6459,"code":"2026","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6459","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"22.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:51:36","date_expires":null,"date_modified":"2026-01-27T13:51:36","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:51:36","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:51:36","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:51:36+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('ae639f58-5cca-4f40-9d51-9fbc2a51d6c3', '2026-04-23T08:57:19.008642+00:00', '1bd711f8-2680-47f6-8e50-5bf807e846d8', 'chethan@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.158.194.159","path":"/api/auth/log-event","email":"chethan@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('7b3a6546-cfb0-4c77-8769-e18225fa92a3', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'f4062b96-a08d-4444-82cc-1ff3c706d5cb', NULL, '{"after":{"id":"f4062b96-a08d-4444-82cc-1ff3c706d5cb","code":"shs","amount":25,"woo_id":6458,"raw_data":{"id":6458,"code":"shs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6458","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:47:49","date_expires":null,"date_modified":"2026-01-27T13:47:49","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:47:49","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:47:49","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:47:49+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('b9713a04-e78b-44ad-9bb7-461708e8345f', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '4a1df6fa-2a32-45f1-b9c6-a99706fa2170', NULL, '{"after":{"id":"4a1df6fa-2a32-45f1-b9c6-a99706fa2170","code":"fbs","amount":26,"woo_id":6457,"raw_data":{"id":6457,"code":"fbs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6457","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:46:15","date_expires":null,"date_modified":"2026-01-27T13:46:15","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:46:15","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:46:15","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,149,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:46:15+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('31129b49-c41b-484d-80c0-a187139f83f5', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '193496be-232e-494d-9904-2db54768627a', NULL, '{"after":{"id":"193496be-232e-494d-9904-2db54768627a","code":"mqhs","amount":30,"woo_id":6456,"raw_data":{"id":6456,"code":"mqhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6456","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:32:54","date_expires":null,"date_modified":"2026-01-27T13:32:54","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:32:54","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:32:54","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:32:54+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('2a0db1a4-d8bf-47ff-a106-34027e6e1f2c', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '10b07423-4d3e-46b2-9b92-6ee4be4f5421', NULL, '{"after":{"id":"10b07423-4d3e-46b2-9b92-6ee4be4f5421","code":"suad26","amount":25,"woo_id":6455,"raw_data":{"id":6455,"code":"suad26","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6455","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:21:42","date_expires":null,"date_modified":"2026-01-27T13:21:42","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:21:42","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:21:42","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:21:42+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('b1c90fd6-2505-46ac-b7d5-5a41c9b1f532', '2026-04-23T08:57:28.613661+00:00', '0430a2de-2b6f-4d2f-956f-fb9fa7197259', 'it@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.158.194.159","path":"/api/auth/log-event","email":"it@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('fb115f3e-344d-4d86-a545-e50cc555e127', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '730eb1b2-056b-4341-8bd5-03067e7c4f00', NULL, '{"after":{"id":"730eb1b2-056b-4341-8bd5-03067e7c4f00","code":"omz26","amount":24,"woo_id":6454,"raw_data":{"id":6454,"code":"omz26","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6454","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"24.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:17:58","date_expires":null,"date_modified":"2026-01-27T13:17:58","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:17:58","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:17:58","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:17:58+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('13effd4a-d871-4f46-8307-f104b8f9d913', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '783a134d-4e51-4627-9153-1fbf134ff6b3', NULL, '{"after":{"id":"783a134d-4e51-4627-9153-1fbf134ff6b3","code":"fbm","amount":25,"woo_id":6453,"raw_data":{"id":6453,"code":"fbm","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6453","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:14:52","date_expires":null,"date_modified":"2026-01-27T13:14:52","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:14:52","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:14:52","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:14:52+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('93f7feb0-7ded-495a-96d6-825309d97cc4', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '837118e0-70a9-45ac-864e-146c6fe4dd6a', NULL, '{"after":{"id":"837118e0-70a9-45ac-864e-146c6fe4dd6a","code":"ths","amount":22,"woo_id":6452,"raw_data":{"id":6452,"code":"ths","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6452","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"22.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:11:54","date_expires":null,"date_modified":"2026-01-27T13:11:54","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:11:54","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:11:54","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:11:54+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('0f36bd66-a3f8-4736-8841-3d0669b3a56d', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '35c6d60b-37de-480c-95d3-abf650668a32', NULL, '{"after":{"id":"35c6d60b-37de-480c-95d3-abf650668a32","code":"rhs","amount":23,"woo_id":6451,"raw_data":{"id":6451,"code":"rhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6451","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"23.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:10:21","date_expires":null,"date_modified":"2026-01-27T13:10:21","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:10:21","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:10:21","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:10:21+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('e36f8ede-4b3c-4b24-a46c-f3cd2c43165a', '2026-04-23T08:57:55.262884+00:00', '0430a2de-2b6f-4d2f-956f-fb9fa7197259', 'it@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.158.194.159","path":"/api/auth/log-event","email":"it@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('3616a260-f29d-46db-a565-d0ee2ced7522', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'fde104e1-30e0-4e31-9c32-886280af9ee1', NULL, '{"after":{"id":"fde104e1-30e0-4e31-9c32-886280af9ee1","code":"aas","amount":25,"woo_id":6450,"raw_data":{"id":6450,"code":"aas","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6450","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:07:29","date_expires":null,"date_modified":"2026-01-27T13:07:29","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:07:29","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:07:29","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:07:29+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('235339a9-66c8-432b-97d4-d1fba55559fd', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '2a39856a-baee-4b14-a2e9-89ffafd27ad9', NULL, '{"after":{"id":"2a39856a-baee-4b14-a2e9-89ffafd27ad9","code":"rbm","amount":24,"woo_id":6449,"raw_data":{"id":6449,"code":"rbm","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6449","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"24.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:04:07","date_expires":null,"date_modified":"2026-01-27T13:04:07","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:04:07","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:04:07","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:04:07+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('9e5db52f-ddaa-47b8-823d-0a8b0df27cb3', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'b4647d5f-6fe6-4ac7-aa8f-49d155b55dad', NULL, '{"after":{"id":"b4647d5f-6fe6-4ac7-aa8f-49d155b55dad","code":"alansarya","amount":25,"woo_id":6448,"raw_data":{"id":6448,"code":"alansarya","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6448","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:59:23","date_expires":null,"date_modified":"2026-01-27T12:59:23","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:59:23","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:59:23","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:59:23+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('1d377fd8-82b8-4557-971b-ea9394054da3', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '8758000c-50a1-4184-8aef-0c381c8be9c8', NULL, '{"after":{"id":"8758000c-50a1-4184-8aef-0c381c8be9c8","code":"sba","amount":24,"woo_id":6447,"raw_data":{"id":6447,"code":"sba","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6447","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"24.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:56:05","date_expires":null,"date_modified":"2026-01-27T12:56:05","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:56:05","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:56:05","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:56:05+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('b80e5911-9d78-49d3-a9f3-3e5798c81b4d', '2026-04-23T08:58:09.456584+00:00', '0430a2de-2b6f-4d2f-956f-fb9fa7197259', 'it@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.158.194.159","path":"/api/auth/log-event","email":"it@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('2b0c8f7a-5eb5-4357-985f-7f6873a2bfb6', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '207fbf04-33f0-494d-a343-b758484d283c', NULL, '{"after":{"id":"207fbf04-33f0-494d-a343-b758484d283c","code":"kba","amount":25,"woo_id":6446,"raw_data":{"id":6446,"code":"kba","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6446","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:53:44","date_expires":null,"date_modified":"2026-01-27T12:53:44","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:53:44","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:53:44","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:53:44+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('6d5b39a6-5b70-4bf6-846d-a33ab77f6067', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '08bd1b72-3479-449e-b8e2-dc9153ec9325', NULL, '{"after":{"id":"08bd1b72-3479-449e-b8e2-dc9153ec9325","code":"gms26","amount":27,"woo_id":6445,"raw_data":{"id":6445,"code":"gms26","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6445","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"27.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:46:22","date_expires":null,"date_modified":"2026-01-27T12:46:22","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:46:22","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:46:22","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:46:22+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('a4856fb5-fa28-4ca4-a7d2-451fea2304b5', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '1e8f2c6f-54f7-4b0c-b8cf-ef1890f383fa', NULL, '{"after":{"id":"1e8f2c6f-54f7-4b0c-b8cf-ef1890f383fa","code":"abkhs","amount":25,"woo_id":6444,"raw_data":{"id":6444,"code":"abkhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6444","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:44:38","date_expires":null,"date_modified":"2026-01-27T12:44:38","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:44:38","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:44:38","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:44:38+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('3c7ccab1-6877-4791-ada2-a9d9ad85d166', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'b25dd88e-aeb4-4910-b4ae-8699ec3d6505', NULL, '{"after":{"id":"b25dd88e-aeb4-4910-b4ae-8699ec3d6505","code":"oahs","amount":26,"woo_id":6443,"raw_data":{"id":6443,"code":"oahs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6443","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:40:20","date_expires":null,"date_modified":"2026-01-27T12:40:20","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:40:20","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:40:20","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:40:20+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('6366bff6-8f2e-48f6-b9e9-7faff31c33dc', '2026-04-23T08:58:20.476544+00:00', '1bd711f8-2680-47f6-8e50-5bf807e846d8', 'chethan@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"172.68.242.90","path":"/api/auth/log-event","email":"chethan@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('9943d87f-4f68-4779-875d-1370fc9cecf1', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '97b23e2e-3b50-4fc6-8cf0-5b8ac3bc3a7a', NULL, '{"after":{"id":"97b23e2e-3b50-4fc6-8cf0-5b8ac3bc3a7a","code":"fbw","amount":26,"woo_id":6442,"raw_data":{"id":6442,"code":"fbw","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6442","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:33:30","date_expires":null,"date_modified":"2026-01-27T12:33:30","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:33:30","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:33:30","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:33:30+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('7373ee5b-aef5-494b-bf51-77f9e944952d', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '6be02b16-6ef0-44e5-bf2e-4111952574ef', NULL, '{"after":{"id":"6be02b16-6ef0-44e5-bf2e-4111952574ef","code":"oma26","amount":26,"woo_id":6441,"raw_data":{"id":6441,"code":"oma26","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6441","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:27:54","date_expires":null,"date_modified":"2026-01-27T12:27:54","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:27:54","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:27:54","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:27:54+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('5eaed7a0-82dc-43d8-b2c9-7185cac4e933', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '4213ba0e-a68b-44bc-9f86-6deb9f70cf55', NULL, '{"after":{"id":"4213ba0e-a68b-44bc-9f86-6deb9f70cf55","code":"aus","amount":26,"woo_id":6440,"raw_data":{"id":6440,"code":"aus","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6440","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:15:42","date_expires":null,"date_modified":"2026-01-27T12:15:42","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:15:42","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:15:42","email_restrictions":[],"exclude_sale_items":false,"product_categories":[60,62,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:15:42+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('eb83c85c-970e-48c7-8d4d-b9fd7c30ab70', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '90481476-b960-4fea-9056-eef2069384c3', NULL, '{"after":{"id":"90481476-b960-4fea-9056-eef2069384c3","code":"bbs","amount":26,"woo_id":6439,"raw_data":{"id":6439,"code":"bbs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6439","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:05:56","date_expires":null,"date_modified":"2026-01-27T12:05:56","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:05:56","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:05:56","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:05:56+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('bb96214f-723e-4226-886c-474f9f52c000', '2026-04-23T08:59:05.810772+00:00', '1bd711f8-2680-47f6-8e50-5bf807e846d8', 'chethan@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.158.194.159","path":"/api/auth/log-event","email":"chethan@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('2f2168cb-f4c9-4280-8167-de462162b0f2', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '379e5258-9564-4ba7-99a8-1dec01ad2a84', NULL, '{"after":{"id":"379e5258-9564-4ba7-99a8-1dec01ad2a84","code":"dbs26","amount":26,"woo_id":6438,"raw_data":{"id":6438,"code":"dbs26","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6438","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:56:24","date_expires":null,"date_modified":"2026-01-27T11:56:24","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:56:24","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:56:24","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:56:24+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('df670659-906d-4b9d-a5f9-c495842b469f', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'bd7e4d10-2ec7-40d8-8229-e24a557d312c', NULL, '{"after":{"id":"bd7e4d10-2ec7-40d8-8229-e24a557d312c","code":"ehs","amount":25,"woo_id":6437,"raw_data":{"id":6437,"code":"ehs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6437","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:41:28","date_expires":null,"date_modified":"2026-01-27T11:41:28","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:41:28","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:41:28","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:41:28+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('caed4174-c583-49d9-ada3-e7144341f051', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '51b1757e-db64-41b7-ad0e-df7b1161fa4a', NULL, '{"after":{"id":"51b1757e-db64-41b7-ad0e-df7b1161fa4a","code":"fhs","amount":20,"woo_id":6436,"raw_data":{"id":6436,"code":"fhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6436","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"20.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:36:41","date_expires":null,"date_modified":"2026-01-27T11:36:41","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:36:41","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:36:41","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:36:41+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('4b3f9abc-3eee-4e45-9aa5-7e4f429d4510', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'f06dca2e-f476-4ce6-a91e-2a9cccbe233c', NULL, '{"after":{"id":"f06dca2e-f476-4ce6-a91e-2a9cccbe233c","code":"sas","amount":26,"woo_id":6435,"raw_data":{"id":6435,"code":"sas","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6435","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:26:45","date_expires":null,"date_modified":"2026-01-27T11:26:45","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:26:45","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:26:45","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:26:45+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('42477f4d-947d-4426-b8ba-9f09a8cb1d9d', '2026-04-23T08:59:37.474568+00:00', '1bd711f8-2680-47f6-8e50-5bf807e846d8', 'chethan@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.158.194.159","path":"/api/auth/log-event","email":"chethan@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('a739920b-d7d0-4e72-bff8-3f0a807e08c1', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'd890ad0e-c628-4123-b7e1-5110321449e8', NULL, '{"after":{"id":"d890ad0e-c628-4123-b7e1-5110321449e8","code":"qhs","amount":30,"woo_id":6434,"raw_data":{"id":6434,"code":"qhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6434","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:23:45","date_expires":null,"date_modified":"2026-01-27T11:23:45","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:23:45","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:23:45","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:23:45+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('5b550469-e9c0-4c21-8f2c-9a2ac7374200', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '5ad1365d-c38e-4c6c-ad36-777572fd9d97', NULL, '{"after":{"id":"5ad1365d-c38e-4c6c-ad36-777572fd9d97","code":"sarwai","amount":22,"woo_id":6433,"raw_data":{"id":6433,"code":"sarwai","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6433","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"22.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:20:25","date_expires":null,"date_modified":"2026-01-27T11:20:25","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:20:25","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:20:25","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,115,92,116,103],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:20:25+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('406f45b9-f33c-437d-88f0-85be284cc6cd', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '510b3d1b-4174-4688-96d1-87884e157664', NULL, '{"after":{"id":"510b3d1b-4174-4688-96d1-87884e157664","code":"aba","amount":33,"woo_id":6432,"raw_data":{"id":6432,"code":"aba","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6432","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"33.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:15:57","date_expires":null,"date_modified":"2026-01-27T11:15:57","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:15:57","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:15:57","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:15:57+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('3ee32fe1-0d00-477c-9c0f-f50ebb945c28', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '49532737-78d6-4bb9-869d-e8284bb9010a', NULL, '{"after":{"id":"49532737-78d6-4bb9-869d-e8284bb9010a","code":"mhs","amount":30,"woo_id":6431,"raw_data":{"id":6431,"code":"mhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6431","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:11:05","date_expires":null,"date_modified":"2026-01-27T11:11:05","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:11:05","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:11:05","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:11:05+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('44d97663-4e11-4c8e-884c-630613d6c38d', '2026-04-23T08:59:57.198226+00:00', '0430a2de-2b6f-4d2f-956f-fb9fa7197259', 'it@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.158.194.159","path":"/api/auth/log-event","email":"it@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('694db965-feef-4ee7-a785-8dd6d2500891', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '8974bb2b-f799-4ef1-9181-76a0e2c5a638', NULL, '{"after":{"id":"8974bb2b-f799-4ef1-9181-76a0e2c5a638","code":"bibi","amount":24,"woo_id":6430,"raw_data":{"id":6430,"code":"bibi","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6430","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"24.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:04:48","date_expires":null,"date_modified":"2026-01-27T11:04:48","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:04:48","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:04:48","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,115,79,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:04:48+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('1b45929d-ddb0-4196-884d-6bdeb7fcf9c3', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'd768bdb0-7509-4e1b-abcf-07fafea9e010', NULL, '{"after":{"id":"d768bdb0-7509-4e1b-abcf-07fafea9e010","code":"bhs","amount":26,"woo_id":6429,"raw_data":{"id":6429,"code":"bhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6429","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:59:56","date_expires":null,"date_modified":"2026-01-27T10:59:56","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:59:56","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:59:56","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:59:56+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('7c09ab3e-b423-4cde-81a9-35ab7031cdbe', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'b3858c79-a26c-461f-baa5-ecb777020a02', NULL, '{"after":{"id":"b3858c79-a26c-461f-baa5-ecb777020a02","code":"aca","amount":25,"woo_id":6428,"raw_data":{"id":6428,"code":"aca","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6428","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:57:00","date_expires":null,"date_modified":"2026-01-27T10:57:00","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:57:00","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:57:00","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:57:00+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('9625ee9a-6ad8-4177-a802-f6e6c9d3c108', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'deb138ee-2a8e-4faf-959c-15b2838a4c3a', NULL, '{"after":{"id":"deb138ee-2a8e-4faf-959c-15b2838a4c3a","code":"obb","amount":15,"woo_id":6427,"raw_data":{"id":6427,"code":"obb","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6427","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"15.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:52:44","date_expires":null,"date_modified":"2026-01-27T10:52:44","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:52:44","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:52:44","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:52:44+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('be15ae06-eb97-4ef7-a136-6f1fb2d99079', '2026-04-23T09:00:05.251825+00:00', '1bd711f8-2680-47f6-8e50-5bf807e846d8', 'chethan@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.158.194.159","path":"/api/auth/log-event","email":"chethan@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('3743391f-0580-4cc5-b545-4f8c9853c116', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '63cfd776-9ca1-4d18-86df-7e37496481d2', NULL, '{"after":{"id":"63cfd776-9ca1-4d18-86df-7e37496481d2","code":"25feb","amount":25,"woo_id":6426,"raw_data":{"id":6426,"code":"25feb","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6426","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:41:46","date_expires":null,"date_modified":"2026-01-27T10:41:46","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:41:46","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:41:46","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:41:46+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('ba1d71fa-c381-405c-88ec-bfe10333e76b', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '5a63b859-06a8-4006-996d-7066439ea808', NULL, '{"after":{"id":"5a63b859-06a8-4006-996d-7066439ea808","code":"rss","amount":30,"woo_id":6425,"raw_data":{"id":6425,"code":"rss","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6425","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:37:01","date_expires":null,"date_modified":"2026-01-27T10:37:01","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:37:01","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:37:01","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:37:01+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('ef32e946-cd13-4e75-abc0-451ddd16998d', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '40ed98ff-ddad-4951-8767-5d25fe9147e9', NULL, '{"after":{"id":"40ed98ff-ddad-4951-8767-5d25fe9147e9","code":"hubs","amount":35,"woo_id":6424,"raw_data":{"id":6424,"code":"hubs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6424","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"35.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:34:22","date_expires":null,"date_modified":"2026-01-27T10:34:22","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:34:22","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:34:22","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,115,92,103,116,79],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:34:22+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('bd4f1d3b-e04f-4062-999f-6097cb0c61a0', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '29a35081-bc81-4749-a68c-931f6e5f7ac6', NULL, '{"after":{"id":"29a35081-bc81-4749-a68c-931f6e5f7ac6","code":"aou","amount":26,"woo_id":6421,"raw_data":{"id":6421,"code":"aou","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6421","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":["1148"],"meta_data":[{"id":62780,"key":"sa_cbl_locations_lookup_in","value":{"address":"billing"}},{"id":62794,"key":"sc_restrict_to_new_user","value":"no"},{"id":62795,"key":"auto_generate_coupon","value":"no"},{"id":62796,"key":"coupon_title_prefix","value":""},{"id":62797,"key":"coupon_title_suffix","value":""},{"id":62798,"key":"sc_coupon_validity","value":""},{"id":62799,"key":"validity_suffix","value":"days"},{"id":62800,"key":"sc_is_visible_storewide","value":"no"},{"id":62801,"key":"sc_disable_email_restriction","value":"no"},{"id":62802,"key":"is_pick_price_of_product","value":"no"},{"id":62803,"key":"wc_sc_add_product_details","value":[]},{"id":62804,"key":"wc_sc_max_discount","value":""},{"id":62805,"key":"wc_sc_expiry_time","value":""},{"id":62806,"key":"wc_sc_auto_apply_coupon","value":"no"},{"id":62807,"key":"sa_cbl_billing_locations","value":[]},{"id":62808,"key":"wc_sc_payment_method_ids","value":[]},{"id":62809,"key":"wc_sc_shipping_method_ids","value":[]},{"id":62810,"key":"wc_sc_user_role_ids","value":[]},{"id":62811,"key":"wc_sc_exclude_user_role_ids","value":[]},{"id":62812,"key":"wc_sc_product_attribute_ids","value":""},{"id":62813,"key":"wc_sc_exclude_product_attribute_ids","value":""},{"id":62814,"key":"wc_sc_taxonomy_restrictions","value":[]},{"id":62815,"key":"wc_sc_excluded_customer_email","value":[]},{"id":62816,"key":"wc_coupon_message","value":""},{"id":62817,"key":"wc_email_message","value":"no"},{"id":62818,"key":"wc_sc_product_quantity_restrictions","value":{"type":"cart","values":{"cart":{"max":"","min":""},"product":[],"product_category":[]},"condition":"any"}},{"id":62819,"key":"wc_sc_cheapest_costliest_settings","value":"1_"},{"id":62820,"key":"product_brands","value":[]},{"id":62821,"key":"exclude_product_brands","value":[]}],"description":"35% Discount","product_ids":[],"usage_count":1,"usage_limit":180,"date_created":"2026-01-27T10:34:12","date_expires":null,"date_modified":"2026-01-27T10:48:46","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:34:12","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:48:46","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":1,"limit_usage_to_x_items":null,"excluded_product_categories":[70,146]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"35% Discount","product_ids":[],"usage_count":1,"usage_limit":180,"date_created":"2026-01-27T10:34:12+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":1}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('eaafa63b-4527-41f5-b353-f0df23079e70', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '326e9024-a7bf-4e52-9bdc-be1e34f172e0', NULL, '{"after":{"id":"326e9024-a7bf-4e52-9bdc-be1e34f172e0","code":"phx","amount":30,"woo_id":6009,"raw_data":{"id":6009,"code":"phx","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6009","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[{"id":58717,"key":"sa_cbl_locations_lookup_in","value":{"address":"billing"}},{"id":58718,"key":"sc_restrict_to_new_user","value":"no"},{"id":58719,"key":"auto_generate_coupon","value":"no"},{"id":58720,"key":"coupon_title_prefix","value":""},{"id":58721,"key":"coupon_title_suffix","value":""},{"id":58722,"key":"sc_coupon_validity","value":""},{"id":58723,"key":"validity_suffix","value":"days"},{"id":58724,"key":"sc_is_visible_storewide","value":"no"},{"id":58725,"key":"sc_disable_email_restriction","value":"no"},{"id":58726,"key":"is_pick_price_of_product","value":"no"},{"id":58727,"key":"wc_sc_add_product_details","value":[]},{"id":58728,"key":"wc_sc_max_discount","value":""},{"id":58729,"key":"wc_sc_expiry_time","value":""},{"id":58730,"key":"wc_sc_auto_apply_coupon","value":"no"},{"id":58731,"key":"sa_cbl_billing_locations","value":[]},{"id":58732,"key":"wc_sc_payment_method_ids","value":[]},{"id":58733,"key":"wc_sc_shipping_method_ids","value":[]},{"id":58734,"key":"wc_sc_user_role_ids","value":[]},{"id":58735,"key":"wc_sc_exclude_user_role_ids","value":[]},{"id":58736,"key":"wc_sc_product_attribute_ids","value":""},{"id":58737,"key":"wc_sc_exclude_product_attribute_ids","value":""},{"id":58738,"key":"wc_sc_taxonomy_restrictions","value":[]},{"id":58739,"key":"wc_sc_excluded_customer_email","value":[]},{"id":58740,"key":"wc_coupon_message","value":""},{"id":58741,"key":"wc_email_message","value":"no"},{"id":58742,"key":"wc_sc_product_quantity_restrictions","value":{"type":"cart","values":{"cart":{"max":"","min":""},"product":[],"product_category":[]},"condition":"any"}},{"id":58743,"key":"wc_sc_cheapest_costliest_settings","value":"1_"},{"id":58744,"key":"product_brands","value":[]},{"id":58745,"key":"exclude_product_brands","value":[]}],"description":"30% off on bags","product_ids":[],"usage_count":0,"usage_limit":20,"date_created":"2025-12-03T11:42:37","date_expires":"2026-01-04T00:00:00","date_modified":"2025-12-03T21:34:14","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2025-12-03T08:42:37","date_expires_gmt":"2026-01-03T21:00:00","date_modified_gmt":"2025-12-03T18:34:14","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":1,"limit_usage_to_x_items":null,"excluded_product_categories":[62,146,70]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"30% off on bags","product_ids":[],"usage_count":0,"usage_limit":20,"date_created":"2025-12-03T11:42:37+00:00","date_expires":"2026-01-04T00:00:00+00:00","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":1}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('8ae035d2-4014-4ae9-8114-41cc7de2f901', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '68abec3d-57b5-44aa-8fff-b2159c4538fc', NULL, '{"after":{"id":"68abec3d-57b5-44aa-8fff-b2159c4538fc","code":"iuk","amount":30,"woo_id":5956,"raw_data":{"id":5956,"code":"iuk","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/5956","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[{"id":58129,"key":"sa_cbl_locations_lookup_in","value":{"address":"billing"}},{"id":58144,"key":"sc_restrict_to_new_user","value":"no"},{"id":58145,"key":"auto_generate_coupon","value":"no"},{"id":58146,"key":"coupon_title_prefix","value":""},{"id":58147,"key":"coupon_title_suffix","value":""},{"id":58148,"key":"sc_coupon_validity","value":""},{"id":58149,"key":"validity_suffix","value":"days"},{"id":58150,"key":"sc_is_visible_storewide","value":"no"},{"id":58151,"key":"sc_disable_email_restriction","value":"no"},{"id":58152,"key":"is_pick_price_of_product","value":"no"},{"id":58153,"key":"wc_sc_add_product_details","value":[]},{"id":58154,"key":"wc_sc_max_discount","value":""},{"id":58155,"key":"wc_sc_expiry_time","value":""},{"id":58156,"key":"wc_sc_auto_apply_coupon","value":"no"},{"id":58157,"key":"sa_cbl_billing_locations","value":[]},{"id":58158,"key":"wc_sc_payment_method_ids","value":[]},{"id":58159,"key":"wc_sc_shipping_method_ids","value":[]},{"id":58160,"key":"wc_sc_user_role_ids","value":[]},{"id":58161,"key":"wc_sc_exclude_user_role_ids","value":[]},{"id":58162,"key":"wc_sc_product_attribute_ids","value":""},{"id":58163,"key":"wc_sc_exclude_product_attribute_ids","value":""},{"id":58164,"key":"wc_sc_taxonomy_restrictions","value":[]},{"id":58165,"key":"wc_sc_excluded_customer_email","value":[]},{"id":58166,"key":"wc_coupon_message","value":""},{"id":58167,"key":"wc_email_message","value":"no"},{"id":58168,"key":"wc_sc_product_quantity_restrictions","value":{"type":"cart","values":{"cart":{"max":"","min":""},"product":[],"product_category":[]},"condition":"any"}},{"id":58169,"key":"wc_sc_cheapest_costliest_settings","value":"1_"},{"id":58170,"key":"product_brands","value":[]},{"id":58171,"key":"exclude_product_brands","value":[]}],"description":"30% off on bags","product_ids":[],"usage_count":0,"usage_limit":20,"date_created":"2025-11-26T10:29:13","date_expires":"2025-12-20T00:00:00","date_modified":"2025-11-26T11:09:24","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2025-11-26T07:29:13","date_expires_gmt":"2025-12-19T21:00:00","date_modified_gmt":"2025-11-26T08:09:24","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":1,"limit_usage_to_x_items":null,"excluded_product_categories":[62,146,70]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"30% off on bags","product_ids":[],"usage_count":0,"usage_limit":20,"date_created":"2025-11-26T10:29:13+00:00","date_expires":"2025-12-20T00:00:00+00:00","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":1}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('b3a424c7-80b2-4fba-a688-ca3d0b689ffb', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'f12a6d2c-b3cf-494e-9bf1-34a57ed05518', NULL, '{"after":{"id":"f12a6d2c-b3cf-494e-9bf1-34a57ed05518","code":"freeship","amount":0,"woo_id":5378,"raw_data":{"id":5378,"code":"freeship","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/5378","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"0.00","status":"publish","used_by":["873","963","1011","1011","963","963","1035","1011","1067","1011","963","1127","1167","1035","1109"],"meta_data":[{"id":50503,"key":"sa_cbl_locations_lookup_in","value":{"address":"billing"}},{"id":50516,"key":"sc_restrict_to_new_user","value":"no"},{"id":50517,"key":"auto_generate_coupon","value":"no"},{"id":50518,"key":"coupon_title_prefix","value":""},{"id":50519,"key":"coupon_title_suffix","value":""},{"id":50520,"key":"sc_coupon_validity","value":""},{"id":50521,"key":"validity_suffix","value":"days"},{"id":50522,"key":"sc_is_visible_storewide","value":"no"},{"id":50523,"key":"sc_disable_email_restriction","value":"no"},{"id":50524,"key":"is_pick_price_of_product","value":"no"},{"id":50525,"key":"wc_sc_add_product_details","value":[]},{"id":50526,"key":"wc_sc_max_discount","value":""},{"id":50527,"key":"wc_sc_expiry_time","value":""},{"id":50528,"key":"wc_sc_auto_apply_coupon","value":"no"},{"id":50529,"key":"sa_cbl_billing_locations","value":[]},{"id":50530,"key":"wc_sc_payment_method_ids","value":[]},{"id":50531,"key":"wc_sc_shipping_method_ids","value":[]},{"id":50532,"key":"wc_sc_user_role_ids","value":[]},{"id":50533,"key":"wc_sc_exclude_user_role_ids","value":[]},{"id":50534,"key":"wc_sc_product_attribute_ids","value":""},{"id":50535,"key":"wc_sc_exclude_product_attribute_ids","value":""},{"id":50536,"key":"wc_sc_taxonomy_restrictions","value":[]},{"id":50537,"key":"wc_sc_excluded_customer_email","value":[]},{"id":50538,"key":"wc_coupon_message","value":""},{"id":50539,"key":"wc_email_message","value":"no"},{"id":50540,"key":"wc_sc_product_quantity_restrictions","value":{"type":"cart","values":{"cart":{"max":"","min":""},"product":[],"product_category":[]},"condition":"any"}},{"id":50541,"key":"wc_sc_cheapest_costliest_settings","value":"1_"},{"id":50542,"key":"product_brands","value":[]},{"id":50543,"key":"exclude_product_brands","value":[]}],"description":"","product_ids":[],"usage_count":15,"usage_limit":null,"date_created":"2025-07-30T10:48:50","date_expires":null,"date_modified":"2025-07-30T10:53:00","discount_type":"fixed_cart","free_shipping":true,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2025-07-30T07:48:50","date_expires_gmt":null,"date_modified_gmt":"2025-07-30T07:53:00","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":15,"usage_limit":null,"date_created":"2025-07-30T10:48:50+00:00","date_expires":null,"discount_type":"fixed_cart","free_shipping":true,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('4221499a-fadd-4fbc-a52a-fd378cdfc68c', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '624adbe0-1046-49dc-8510-d19a1f174b5e', NULL, '{"after":{"id":"624adbe0-1046-49dc-8510-d19a1f174b5e","code":"todoo","amount":10,"woo_id":5108,"raw_data":{"id":5108,"code":"todoo","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/5108","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"10.00","status":"publish","used_by":["shoug138@hotmail.com"],"meta_data":[],"description":"","product_ids":[],"usage_count":1,"usage_limit":null,"date_created":"2025-06-09T14:19:18","date_expires":"2026-01-26T00:00:00","date_modified":"2025-06-09T14:19:18","discount_type":"fixed_product","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2025-06-09T11:19:18","date_expires_gmt":"2026-01-25T21:00:00","date_modified_gmt":"2025-06-09T11:19:18","email_restrictions":[],"exclude_sale_items":false,"product_categories":[70],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[],"usage_count":1,"usage_limit":null,"date_created":"2025-06-09T14:19:18+00:00","date_expires":"2026-01-26T00:00:00+00:00","discount_type":"fixed_product","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('933390a0-36c0-477f-bab0-19c64040b669', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '313c57a4-d32e-4e05-836a-9c845ca398f7', NULL, '{"after":{"id":"313c57a4-d32e-4e05-836a-9c845ca398f7","code":"free","amount":10,"woo_id":4597,"raw_data":{"id":4597,"code":"free","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/4597","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"10.00","status":"publish","used_by":["624","624","632","namareqsanaa@gmail.com"],"meta_data":[],"description":"","product_ids":[4423,4424,4425,4426,4427,4430,4431,4432,4433,4434,3823,3586,2853,2854,2855,2856,2857,2859,2860,2861,2862,2863,4112,1747,4110,2768,1759,2871,2872,2873,2874,2875,2883,2884,2885,2886,2887,3860,4108,4146,3862,3825,3773,4148,3471,3655,3142,2477,2478,2479,2480,2481,2484,2485,2486,2487,2488,4174,3150,3028,3029,3030,3031,3032,3033,3034,3035,3036,3037,3038,3039,3040,3041,3042,3043,3044,3045,3046,3047,3871,4349,4350,4351,4352,4353,1755,4106,1777,2157,2154,2655,1761,4163,4164,4165,4166,4167,1763,1737,2450,1743,4295,2703,1745,1741,2681,1735,2259,1739,3836,3450,3451,3452,3453,3454,4342,2438,3417,3418,3419,3420,3421,2441,2443,2803,2489,3751,1757,4132,3864,3753,3055,3514,3684,1765,1775,2129,4436,3615,3616,3617,3618,3619,2695,3267,1749,1751,1753],"usage_count":4,"usage_limit":null,"date_created":"2025-02-27T23:33:59","date_expires":"2025-10-10T00:00:00","date_modified":"2025-02-27T23:33:59","discount_type":"percent","free_shipping":true,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2025-02-27T20:33:59","date_expires_gmt":"2025-10-09T21:00:00","date_modified_gmt":"2025-02-27T20:33:59","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[4423,4424,4425,4426,4427,4430,4431,4432,4433,4434,3823,3586,2853,2854,2855,2856,2857,2859,2860,2861,2862,2863,4112,1747,4110,2768,1759,2871,2872,2873,2874,2875,2883,2884,2885,2886,2887,3860,4108,4146,3862,3825,3773,4148,3471,3655,3142,2477,2478,2479,2480,2481,2484,2485,2486,2487,2488,4174,3150,3028,3029,3030,3031,3032,3033,3034,3035,3036,3037,3038,3039,3040,3041,3042,3043,3044,3045,3046,3047,3871,4349,4350,4351,4352,4353,1755,4106,1777,2157,2154,2655,1761,4163,4164,4165,4166,4167,1763,1737,2450,1743,4295,2703,1745,1741,2681,1735,2259,1739,3836,3450,3451,3452,3453,3454,4342,2438,3417,3418,3419,3420,3421,2441,2443,2803,2489,3751,1757,4132,3864,3753,3055,3514,3684,1765,1775,2129,4436,3615,3616,3617,3618,3619,2695,3267,1749,1751,1753],"usage_count":4,"usage_limit":null,"date_created":"2025-02-27T23:33:59+00:00","date_expires":"2025-10-10T00:00:00+00:00","discount_type":"percent","free_shipping":true,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('0609bf80-3993-40fc-817d-1c57cfd73d70', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'f27be663-1038-47a4-8e3d-429162fe9353', NULL, '{"after":{"id":"f27be663-1038-47a4-8e3d-429162fe9353","code":"zk","amount":15,"woo_id":3959,"raw_data":{"id":3959,"code":"zk","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/3959","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"15.00","status":"publish","used_by":["342","344","353","379","400","605","624"],"meta_data":[],"description":"","product_ids":[3823,3586,1747,3860,3862,3825,3773,3471,3655,3142,3150,3871,1755,2655,1761,1763,1737,2450,1743,2703,1745,1741,2681,1735,2259,1739,3836,3864,3055,3684,1765,1749,3514,3267,4106,4430,4431,4432,4433,4434,4423,4424,4425,4426,4427,4112,4110,2768,1759,2871,2872,2873,2874,2875,2883,2884,2885,2886,2887,4108,4146,4148,2477,2478,2479,2480,2481,2484,2485,2486,2487,2488,4174,3028,3029,3030,3031,3032,3033,3034,3035,3036,3037,3038,3039,3040,3041,3042,3043,3044,3045,3046,3047,4349,4350,4351,4352,4353,1777,2154,4163,4164,4165,4166,4167,4295,3450,3451,3452,3453,3454,4342,3417,3418,3419,3420,3421,2438,2441,2443,2803,2489,3751,1757,4132,3753,1775,2129,4436,2695,3615,3616,3617,3618,3619,2250,2251,2252,1751,1753],"usage_count":7,"usage_limit":null,"date_created":"2024-12-24T17:24:09","date_expires":"2025-03-01T00:00:00","date_modified":"2025-02-28T16:02:21","discount_type":"percent","free_shipping":true,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2024-12-24T14:24:09","date_expires_gmt":"2025-02-28T21:00:00","date_modified_gmt":"2025-02-28T13:02:21","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[3823,3586,1747,3860,3862,3825,3773,3471,3655,3142,3150,3871,1755,2655,1761,1763,1737,2450,1743,2703,1745,1741,2681,1735,2259,1739,3836,3864,3055,3684,1765,1749,3514,3267,4106,4430,4431,4432,4433,4434,4423,4424,4425,4426,4427,4112,4110,2768,1759,2871,2872,2873,2874,2875,2883,2884,2885,2886,2887,4108,4146,4148,2477,2478,2479,2480,2481,2484,2485,2486,2487,2488,4174,3028,3029,3030,3031,3032,3033,3034,3035,3036,3037,3038,3039,3040,3041,3042,3043,3044,3045,3046,3047,4349,4350,4351,4352,4353,1777,2154,4163,4164,4165,4166,4167,4295,3450,3451,3452,3453,3454,4342,3417,3418,3419,3420,3421,2438,2441,2443,2803,2489,3751,1757,4132,3753,1775,2129,4436,2695,3615,3616,3617,3618,3619,2250,2251,2252,1751,1753],"usage_count":7,"usage_limit":null,"date_created":"2024-12-24T17:24:09+00:00","date_expires":"2025-03-01T00:00:00+00:00","discount_type":"percent","free_shipping":true,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('04268bab-9ff9-4e99-8020-1d3a13c7a013', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '6e565939-bea6-4127-8fab-11a629f33827', NULL, '{"after":{"id":"6e565939-bea6-4127-8fab-11a629f33827","code":"opt","amount":15,"woo_id":3944,"raw_data":{"id":3944,"code":"opt","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/3944","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"15.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[3586,3860,3862,3773,3871,1755,2655,2259,3751,3864,3055,3684,1765,3615,3617,3618,3619,2695,3150],"usage_count":0,"usage_limit":null,"date_created":"2024-12-23T18:24:43","date_expires":"2024-12-25T00:00:00","date_modified":"2024-12-23T18:24:43","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2024-12-23T15:24:43","date_expires_gmt":"2024-12-24T21:00:00","date_modified_gmt":"2024-12-23T15:24:43","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"","product_ids":[3586,3860,3862,3773,3871,1755,2655,2259,3751,3864,3055,3684,1765,3615,3617,3618,3619,2695,3150],"usage_count":0,"usage_limit":null,"date_created":"2024-12-23T18:24:43+00:00","date_expires":"2024-12-25T00:00:00+00:00","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('2e3eee42-d398-41b9-b27d-28b28bc58928', '2026-04-23T07:06:27.730439+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '540a139c-e4c1-4839-bcb5-34a190bdf618', NULL, '{"after":{"id":"540a139c-e4c1-4839-bcb5-34a190bdf618","code":"3h","amount":12,"woo_id":3096,"raw_data":{"id":3096,"code":"3h","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/3096","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"12.00","status":"publish","used_by":["65"],"meta_data":[{"id":29490,"key":"sa_cbl_locations_lookup_in","value":{"address":"billing"}},{"id":29540,"key":"sc_restrict_to_new_user","value":"no"},{"id":29541,"key":"auto_generate_coupon","value":"no"},{"id":29542,"key":"coupon_title_prefix","value":""},{"id":29543,"key":"coupon_title_suffix","value":""},{"id":29544,"key":"sc_coupon_validity","value":""},{"id":29545,"key":"validity_suffix","value":"days"},{"id":29546,"key":"sc_is_visible_storewide","value":"no"},{"id":29547,"key":"sc_disable_email_restriction","value":"no"},{"id":29548,"key":"is_pick_price_of_product","value":"no"},{"id":29549,"key":"wc_sc_add_product_details","value":[]},{"id":29550,"key":"wc_sc_max_discount","value":""},{"id":29551,"key":"wc_sc_expiry_time","value":"76500"},{"id":29552,"key":"wc_sc_auto_apply_coupon","value":"no"},{"id":29553,"key":"sa_cbl_billing_locations","value":[]},{"id":29554,"key":"wc_sc_payment_method_ids","value":[]},{"id":29555,"key":"wc_sc_shipping_method_ids","value":[]},{"id":29556,"key":"wc_sc_user_role_ids","value":[]},{"id":29557,"key":"wc_sc_exclude_user_role_ids","value":[]},{"id":29558,"key":"wc_sc_product_attribute_ids","value":""},{"id":29559,"key":"wc_sc_exclude_product_attribute_ids","value":""},{"id":29560,"key":"wc_sc_taxonomy_restrictions","value":[]},{"id":29561,"key":"wc_sc_excluded_customer_email","value":[]},{"id":29562,"key":"wc_coupon_message","value":""},{"id":29563,"key":"wc_email_message","value":"no"},{"id":29564,"key":"wc_sc_product_quantity_restrictions","value":{"type":"cart","values":{"cart":{"max":"","min":""},"product":[],"product_category":[]},"condition":"any"}},{"id":29565,"key":"wc_sc_cheapest_costliest_settings","value":"1_"}],"description":"This coupon is valid for use within a 3-hour period only. Make sure to redeem it promptly to enjoy the offer!","product_ids":[],"usage_count":1,"usage_limit":null,"date_created":"2024-10-02T14:19:32","date_expires":"2024-10-02T00:00:00","date_modified":"2024-10-02T18:17:28","discount_type":"percent","free_shipping":false,"individual_use":true,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2024-10-02T11:19:32","date_expires_gmt":"2024-10-01T21:00:00","date_modified_gmt":"2024-10-02T15:17:28","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":1,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"0bea4424-f02a-4fc2-b1c1-05045d7fd791","synced_at":"2026-04-23T07:06:27.693+00:00","created_at":"2026-04-23T07:06:27.730439+00:00","description":"This coupon is valid for use within a 3-hour period only. Make sure to redeem it promptly to enjoy the offer!","product_ids":[],"usage_count":1,"usage_limit":null,"date_created":"2024-10-02T14:19:32+00:00","date_expires":"2024-10-02T00:00:00+00:00","discount_type":"percent","free_shipping":false,"individual_use":true,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":1}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('874deb8a-b7d4-47e5-b8c2-0970ae23611b', '2026-04-23T08:00:27.263921+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', 'b11843fe-258d-456d-aaec-d01a27cfda0c', NULL, '{"before":{"id":"b11843fe-258d-456d-aaec-d01a27cfda0c","code":"opt","amount":15,"woo_id":3944,"raw_data":{"id":3944,"code":"opt","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/3944","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"15.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[3586,3860,3862,3773,3871,1755,2655,2259,3751,3864,3055,3684,1765,3615,3617,3618,3619,2695,3150],"usage_count":0,"usage_limit":null,"date_created":"2024-12-23T18:24:43","date_expires":"2024-12-25T00:00:00","date_modified":"2024-12-23T18:24:43","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2024-12-23T15:24:43","date_expires_gmt":"2024-12-24T21:00:00","date_modified_gmt":"2024-12-23T15:24:43","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"b2c0b1be-c9a1-4d3f-bae1-74949a16ae92","synced_at":"2026-04-21T04:26:43.169+00:00","created_at":"2026-04-21T04:26:43.240395+00:00","description":"","product_ids":[3586,3860,3862,3773,3871,1755,2655,2259,3751,3864,3055,3684,1765,3615,3617,3618,3619,2695,3150],"usage_count":0,"usage_limit":null,"date_created":"2024-12-23T18:24:43+00:00","date_expires":"2024-12-25T00:00:00+00:00","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('68936374-cae3-4af2-bdbd-2ccd79a1ee7d', '2026-04-23T08:00:27.263921+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '873e9e3d-cb5c-4a97-916c-7d247be54e7f', NULL, '{"before":{"id":"873e9e3d-cb5c-4a97-916c-7d247be54e7f","code":"3h","amount":12,"woo_id":3096,"raw_data":{"id":3096,"code":"3h","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/3096","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"12.00","status":"publish","used_by":["65"],"meta_data":[{"id":29490,"key":"sa_cbl_locations_lookup_in","value":{"address":"billing"}},{"id":29540,"key":"sc_restrict_to_new_user","value":"no"},{"id":29541,"key":"auto_generate_coupon","value":"no"},{"id":29542,"key":"coupon_title_prefix","value":""},{"id":29543,"key":"coupon_title_suffix","value":""},{"id":29544,"key":"sc_coupon_validity","value":""},{"id":29545,"key":"validity_suffix","value":"days"},{"id":29546,"key":"sc_is_visible_storewide","value":"no"},{"id":29547,"key":"sc_disable_email_restriction","value":"no"},{"id":29548,"key":"is_pick_price_of_product","value":"no"},{"id":29549,"key":"wc_sc_add_product_details","value":[]},{"id":29550,"key":"wc_sc_max_discount","value":""},{"id":29551,"key":"wc_sc_expiry_time","value":"76500"},{"id":29552,"key":"wc_sc_auto_apply_coupon","value":"no"},{"id":29553,"key":"sa_cbl_billing_locations","value":[]},{"id":29554,"key":"wc_sc_payment_method_ids","value":[]},{"id":29555,"key":"wc_sc_shipping_method_ids","value":[]},{"id":29556,"key":"wc_sc_user_role_ids","value":[]},{"id":29557,"key":"wc_sc_exclude_user_role_ids","value":[]},{"id":29558,"key":"wc_sc_product_attribute_ids","value":""},{"id":29559,"key":"wc_sc_exclude_product_attribute_ids","value":""},{"id":29560,"key":"wc_sc_taxonomy_restrictions","value":[]},{"id":29561,"key":"wc_sc_excluded_customer_email","value":[]},{"id":29562,"key":"wc_coupon_message","value":""},{"id":29563,"key":"wc_email_message","value":"no"},{"id":29564,"key":"wc_sc_product_quantity_restrictions","value":{"type":"cart","values":{"cart":{"max":"","min":""},"product":[],"product_category":[]},"condition":"any"}},{"id":29565,"key":"wc_sc_cheapest_costliest_settings","value":"1_"}],"description":"This coupon is valid for use within a 3-hour period only. Make sure to redeem it promptly to enjoy the offer!","product_ids":[],"usage_count":1,"usage_limit":null,"date_created":"2024-10-02T14:19:32","date_expires":"2024-10-02T00:00:00","date_modified":"2024-10-02T18:17:28","discount_type":"percent","free_shipping":false,"individual_use":true,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2024-10-02T11:19:32","date_expires_gmt":"2024-10-01T21:00:00","date_modified_gmt":"2024-10-02T15:17:28","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":1,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"b2c0b1be-c9a1-4d3f-bae1-74949a16ae92","synced_at":"2026-04-21T04:26:43.169+00:00","created_at":"2026-04-21T04:26:43.240395+00:00","description":"This coupon is valid for use within a 3-hour period only. Make sure to redeem it promptly to enjoy the offer!","product_ids":[],"usage_count":1,"usage_limit":null,"date_created":"2024-10-02T14:19:32+00:00","date_expires":"2024-10-02T00:00:00+00:00","discount_type":"percent","free_shipping":false,"individual_use":true,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":1}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('ed1e9bb5-fe68-4138-a6ee-6a2e2be609dd', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '1920aa6c-574a-4ac8-be7a-a00c4ac840aa', NULL, '{"after":{"id":"1920aa6c-574a-4ac8-be7a-a00c4ac840aa","code":"shamiya","amount":25,"woo_id":6464,"raw_data":{"id":6464,"code":"shamiya","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6464","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T15:09:12","date_expires":null,"date_modified":"2026-01-27T15:09:12","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T12:09:12","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T12:09:12","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T15:09:12+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('67a27f74-dc4e-42fe-a153-63cce88ce712', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '6035888f-9af1-4523-b1c4-5bb6157f5d9b', NULL, '{"after":{"id":"6035888f-9af1-4523-b1c4-5bb6157f5d9b","code":"jhs","amount":29,"woo_id":6463,"raw_data":{"id":6463,"code":"jhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6463","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"29.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:26:33","date_expires":null,"date_modified":"2026-01-27T14:26:33","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T11:26:33","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T11:26:33","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:26:33+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('8be06e0d-7425-4f4a-a5b8-882a72378606', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '289c2b1a-5316-4d47-8bf9-5f10d07fb648', NULL, '{"after":{"id":"289c2b1a-5316-4d47-8bf9-5f10d07fb648","code":"dhs","amount":26,"woo_id":6462,"raw_data":{"id":6462,"code":"dhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6462","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:20:44","date_expires":null,"date_modified":"2026-01-27T14:20:44","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T11:20:44","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T11:20:44","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:20:44+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('0d487864-e706-4604-9535-1105701ef3e3', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '47b6b57a-fdeb-4914-ae2f-023361aaf005', NULL, '{"after":{"id":"47b6b57a-fdeb-4914-ae2f-023361aaf005","code":"yhs","amount":29,"woo_id":6461,"raw_data":{"id":6461,"code":"yhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6461","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"29.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:06:32","date_expires":null,"date_modified":"2026-01-27T14:06:32","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T11:06:32","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T11:06:32","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:06:32+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('3a331385-412d-4411-ae71-f2e89a8272a4', '2026-04-23T08:35:40.947096+00:00', '4639fed7-01dd-49f7-85dd-54e56111a352', 'arvind@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"172.70.108.239","path":"/api/auth/log-event","email":"arvind@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('02048cdb-84bb-4ebc-abc4-319d8c1e02f2', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '3aa53491-62fb-42c5-9eac-989a2c9df409', NULL, '{"after":{"id":"3aa53491-62fb-42c5-9eac-989a2c9df409","code":"kbs","amount":25,"woo_id":6460,"raw_data":{"id":6460,"code":"kbs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6460","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:59:02","date_expires":null,"date_modified":"2026-01-27T13:59:02","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:59:02","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:59:02","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:59:02+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('a5da5f9b-54ba-403e-a587-6f8d5fd7f9f8', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'c321b277-2813-42b2-beb2-74d005a12b39', NULL, '{"after":{"id":"c321b277-2813-42b2-beb2-74d005a12b39","code":"2026","amount":22,"woo_id":6459,"raw_data":{"id":6459,"code":"2026","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6459","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"22.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:51:36","date_expires":null,"date_modified":"2026-01-27T13:51:36","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:51:36","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:51:36","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:51:36+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('5d772c52-b0d4-4ac0-82e6-9483ec3e63ab', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'b317aa8d-75c0-40a8-a27a-823aa898ec99', NULL, '{"after":{"id":"b317aa8d-75c0-40a8-a27a-823aa898ec99","code":"shs","amount":25,"woo_id":6458,"raw_data":{"id":6458,"code":"shs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6458","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:47:49","date_expires":null,"date_modified":"2026-01-27T13:47:49","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:47:49","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:47:49","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:47:49+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('31594af7-fb3b-46ba-b9fd-be5e7bff5284', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '5f581b9e-38f1-48db-94a3-453a4cc284e2', NULL, '{"after":{"id":"5f581b9e-38f1-48db-94a3-453a4cc284e2","code":"fbs","amount":26,"woo_id":6457,"raw_data":{"id":6457,"code":"fbs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6457","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:46:15","date_expires":null,"date_modified":"2026-01-27T13:46:15","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:46:15","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:46:15","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,149,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:46:15+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('defe3019-198b-45e4-b31c-2d44ec1dfb95', '2026-04-23T08:35:51.195981+00:00', '4639fed7-01dd-49f7-85dd-54e56111a352', 'arvind@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"172.70.108.239","path":"/api/auth/log-event","email":"arvind@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('e8abb12c-c8aa-482a-aa04-5ead24bba1e9', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'f6cda8af-65a2-4025-92a2-7bcd0b27dab0', NULL, '{"after":{"id":"f6cda8af-65a2-4025-92a2-7bcd0b27dab0","code":"mqhs","amount":30,"woo_id":6456,"raw_data":{"id":6456,"code":"mqhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6456","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:32:54","date_expires":null,"date_modified":"2026-01-27T13:32:54","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:32:54","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:32:54","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:32:54+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('437411d6-06c8-4d24-b0f8-3ea27cd81c61', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '5a9dfeea-d9e0-4068-a3ff-f331264b2b90', NULL, '{"after":{"id":"5a9dfeea-d9e0-4068-a3ff-f331264b2b90","code":"suad26","amount":25,"woo_id":6455,"raw_data":{"id":6455,"code":"suad26","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6455","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:21:42","date_expires":null,"date_modified":"2026-01-27T13:21:42","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:21:42","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:21:42","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:21:42+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('ecb27fcc-c6b5-4491-b886-0c8f9f794a34', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'c4bbcbf2-427f-4133-86c6-01f7bb591217', NULL, '{"after":{"id":"c4bbcbf2-427f-4133-86c6-01f7bb591217","code":"omz26","amount":24,"woo_id":6454,"raw_data":{"id":6454,"code":"omz26","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6454","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"24.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:17:58","date_expires":null,"date_modified":"2026-01-27T13:17:58","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:17:58","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:17:58","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:17:58+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('7bfcb385-9da8-4fb8-9738-fac008f20b15', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '0c853d70-82ac-49d6-a76e-7d98dc5849e9', NULL, '{"after":{"id":"0c853d70-82ac-49d6-a76e-7d98dc5849e9","code":"fbm","amount":25,"woo_id":6453,"raw_data":{"id":6453,"code":"fbm","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6453","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:14:52","date_expires":null,"date_modified":"2026-01-27T13:14:52","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:14:52","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:14:52","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:14:52+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('e6f04c03-eec5-4ce2-8bfb-e3b274c72d4c', '2026-04-23T08:36:52.01767+00:00', '4639fed7-01dd-49f7-85dd-54e56111a352', 'arvind@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"172.68.234.24","path":"/api/auth/log-event","email":"arvind@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('bcb6e2a5-d299-42d2-a5f9-5b2a1268bd1f', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '34d69fca-5d6f-448f-b0fa-953eb6f57540', NULL, '{"after":{"id":"34d69fca-5d6f-448f-b0fa-953eb6f57540","code":"ths","amount":22,"woo_id":6452,"raw_data":{"id":6452,"code":"ths","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6452","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"22.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:11:54","date_expires":null,"date_modified":"2026-01-27T13:11:54","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:11:54","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:11:54","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:11:54+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('98de70d1-a2da-403f-bcb0-9d55a161f981', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '4558a38a-d90d-46e5-99c7-e26b6e7c61f8', NULL, '{"after":{"id":"4558a38a-d90d-46e5-99c7-e26b6e7c61f8","code":"rhs","amount":23,"woo_id":6451,"raw_data":{"id":6451,"code":"rhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6451","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"23.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:10:21","date_expires":null,"date_modified":"2026-01-27T13:10:21","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:10:21","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:10:21","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:10:21+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('3988a60f-e6c4-432a-a134-db1115adac04', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '8662ea4a-9519-42fe-9a9e-9965a7a8c111', NULL, '{"after":{"id":"8662ea4a-9519-42fe-9a9e-9965a7a8c111","code":"aas","amount":25,"woo_id":6450,"raw_data":{"id":6450,"code":"aas","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6450","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:07:29","date_expires":null,"date_modified":"2026-01-27T13:07:29","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:07:29","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:07:29","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:07:29+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('e568aa06-8085-496f-a30e-c3f3fcca6eb4', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '7600b544-b070-411f-b00a-30df26306298', NULL, '{"after":{"id":"7600b544-b070-411f-b00a-30df26306298","code":"rbm","amount":24,"woo_id":6449,"raw_data":{"id":6449,"code":"rbm","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6449","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"24.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:04:07","date_expires":null,"date_modified":"2026-01-27T13:04:07","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:04:07","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:04:07","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:04:07+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('9cba8ba1-55bf-4a11-980d-10d2830eb3a7', '2026-04-23T08:38:52.519662+00:00', '4639fed7-01dd-49f7-85dd-54e56111a352', 'arvind@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.159.122.17","path":"/api/auth/log-event","email":"arvind@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('52a3954d-edee-4520-86a3-3053b78b7b8e', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'a81d1a7a-1ad6-4d7e-bfa6-75028832f176', NULL, '{"after":{"id":"a81d1a7a-1ad6-4d7e-bfa6-75028832f176","code":"alansarya","amount":25,"woo_id":6448,"raw_data":{"id":6448,"code":"alansarya","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6448","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:59:23","date_expires":null,"date_modified":"2026-01-27T12:59:23","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:59:23","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:59:23","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:59:23+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('30d92b11-3887-4f38-981e-d4511f2641e0', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'b5c22e6a-233e-438f-a6fb-eb333fbf986b', NULL, '{"after":{"id":"b5c22e6a-233e-438f-a6fb-eb333fbf986b","code":"sba","amount":24,"woo_id":6447,"raw_data":{"id":6447,"code":"sba","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6447","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"24.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:56:05","date_expires":null,"date_modified":"2026-01-27T12:56:05","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:56:05","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:56:05","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:56:05+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('3bea99a9-5cfc-45e2-b0cc-56b65517d28c', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'c00054a6-4913-4d69-a7f3-12e368fb465c', NULL, '{"after":{"id":"c00054a6-4913-4d69-a7f3-12e368fb465c","code":"kba","amount":25,"woo_id":6446,"raw_data":{"id":6446,"code":"kba","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6446","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:53:44","date_expires":null,"date_modified":"2026-01-27T12:53:44","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:53:44","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:53:44","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:53:44+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('54b48051-bde3-4b1d-aa59-a574159ec188', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '6a706f96-4dfc-4b0e-ac3d-4841f92109ca', NULL, '{"after":{"id":"6a706f96-4dfc-4b0e-ac3d-4841f92109ca","code":"gms26","amount":27,"woo_id":6445,"raw_data":{"id":6445,"code":"gms26","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6445","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"27.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:46:22","date_expires":null,"date_modified":"2026-01-27T12:46:22","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:46:22","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:46:22","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:46:22+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('4382c172-5a74-41f7-934c-8a9c0c115835', '2026-04-23T08:39:50.011194+00:00', '4639fed7-01dd-49f7-85dd-54e56111a352', 'arvind@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.159.122.17","path":"/api/auth/log-event","email":"arvind@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('321dda61-9244-4860-a5a7-e57bd3b553b6', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'c068fba8-9573-4235-b438-1cb0d05621b5', NULL, '{"after":{"id":"c068fba8-9573-4235-b438-1cb0d05621b5","code":"abkhs","amount":25,"woo_id":6444,"raw_data":{"id":6444,"code":"abkhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6444","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:44:38","date_expires":null,"date_modified":"2026-01-27T12:44:38","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:44:38","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:44:38","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:44:38+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('6885b450-b16f-48c7-baf4-8d9e4ec15d64', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '8fa9c5dd-2ebd-49d1-9534-6e999dfb3992', NULL, '{"after":{"id":"8fa9c5dd-2ebd-49d1-9534-6e999dfb3992","code":"oahs","amount":26,"woo_id":6443,"raw_data":{"id":6443,"code":"oahs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6443","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:40:20","date_expires":null,"date_modified":"2026-01-27T12:40:20","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:40:20","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:40:20","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:40:20+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('9b628547-796f-46c1-8dba-4951f1383635', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '9f680f65-6a78-439c-83d5-c6db29e3b954', NULL, '{"after":{"id":"9f680f65-6a78-439c-83d5-c6db29e3b954","code":"fbw","amount":26,"woo_id":6442,"raw_data":{"id":6442,"code":"fbw","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6442","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:33:30","date_expires":null,"date_modified":"2026-01-27T12:33:30","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:33:30","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:33:30","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:33:30+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('5f3cf991-85a1-43e6-b72f-f7e82a851373', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'e316f131-720a-4a38-b6d3-9caee9865e92', NULL, '{"after":{"id":"e316f131-720a-4a38-b6d3-9caee9865e92","code":"oma26","amount":26,"woo_id":6441,"raw_data":{"id":6441,"code":"oma26","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6441","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:27:54","date_expires":null,"date_modified":"2026-01-27T12:27:54","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:27:54","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:27:54","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:27:54+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('7de68a70-db73-4141-a7d6-b19b2cd543b6', '2026-04-23T08:40:07.059417+00:00', NULL, NULL, 'system', 'product.update', 'product', '80317759-13b7-4a9a-bcc2-fd35e6da1a60', NULL, '{"after":{"status":"draft","raw_data":{"id":7146,"sku":"ertyhgfd","name":"test demo","slug":"test-demo","tags":[],"type":"simple","price":"4.99","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/products/7146","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/products"}]},"brands":[],"images":[],"status":"draft","weight":"0.25","on_sale":true,"virtual":false,"featured":false,"downloads":[],"meta_data":[{"id":79656,"key":"_elementor_page_assets","value":[]}],"parent_id":0,"permalink":"https://todookw.com/?post_type=product&p=7146","tax_class":"","attributes":[],"backorders":"no","categories":[{"id":62,"name":"Accessories","slug":"accessories"}],"dimensions":{"width":"","height":"","length":""},"menu_order":0,"price_html":"<del aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>10.00&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></del> <span class=\"screen-reader-text\">Original price was: 10.00&nbsp;KWD.</span><ins aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>4.99&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></ins><span class=\"screen-reader-text\">Current price is: 4.99&nbsp;KWD.</span>","sale_price":"4.99","tax_status":"taxable","upsell_ids":[],"variations":[],"backordered":false,"button_text":"","description":"<h3>Cryo facial tools are cooling skincare devices designed to improve skin appearance using cold therapy (cryotherapy). </p>\n<p>These tools are typically made from glass or stainless steel and filled with cooling liquid, allowing them to stay cold for longer durations.</h3>\n<p>They are used by gently gliding over the face to provide a <strong>refreshing massage that helps reduce puffiness, tighten pores, and enhance skin glow</strong>. The cooling effect helps <strong>constrict blood vessels and reduce inflammation</strong>, giving the skin a firmer and more refreshed look.</p>\n","has_options":false,"purchasable":true,"related_ids":[5862,5860,5560,5573,2768],"total_sales":0,"date_created":"2026-04-23T11:30:26","downloadable":false,"external_url":"","manage_stock":false,"rating_count":0,"stock_status":"instock","date_modified":"2026-04-23T11:40:06","post_password":"","purchase_note":"","regular_price":"10","average_rating":"0","cross_sell_ids":[],"download_limit":-1,"generated_slug":"test-demo","shipping_class":"","stock_quantity":null,"date_on_sale_to":null,"download_expiry":-1,"reviews_allowed":true,"date_created_gmt":"2026-04-23T08:30:26","global_unique_id":"","grouped_products":[],"low_stock_amount":null,"shipping_taxable":true,"date_modified_gmt":"2026-04-23T08:40:06","date_on_sale_from":null,"shipping_class_id":0,"shipping_required":true,"short_description":"","sold_individually":false,"backorders_allowed":false,"catalog_visibility":"visible","default_attributes":[],"permalink_template":"https://todookw.com/product/%pagename%/","date_on_sale_to_gmt":null,"date_on_sale_from_gmt":null},"synced_at":"2026-04-23T08:40:07.016+00:00","short_description":""},"before":{"status":"publish","raw_data":{"id":7146,"sku":"ertyhgfd","name":"test demo","slug":"test-demo","tags":[],"type":"simple","price":"4.99","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/products/7146","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/products"}]},"brands":[],"images":[],"status":"publish","weight":"0.25","on_sale":true,"virtual":false,"featured":false,"downloads":[],"meta_data":[{"id":79656,"key":"_elementor_page_assets","value":[]},{"id":79657,"key":"wd_page_css_files","value":["widget-recent-post-comments","widget-wd-recent-posts","widget-nav","widget-wd-layered-nav","woo-mod-swatches-base","woo-mod-swatches-filter","widget-slider-price-filter","wpcf7","elementor-base","woocommerce-base","mod-star-rating","woo-el-track-order","woocommerce-block-notices","woo-mod-quantity","woo-single-prod-el-base","woo-mod-stock-status","woo-opt-hide-larger-price","woo-mod-shop-attributes","header-base","mod-tools","woo-mod-login-form","header-my-account","header-search","wd-search-results","wd-search-form","header-elements-base","header-cart-side","header-cart","widget-shopping-cart","widget-product-list","header-mobile-nav-dropdown","woo-single-prod-builder","photoswipe","woo-single-prod-el-gallery","swiper","woo-mod-product-labels","woo-mod-product-labels-rect","swiper-arrows","woo-el-breadcrumbs-builder","add-to-cart-popup","mfp-popup","woo-opt-title-limit","product-loop","product-loop-tiled","woo-mod-swatches-style-3","woo-mod-swatches-dis-1","footer-base","marquee","text-block","mod-nav-vertical","mod-nav-vertical-design-simple","widget-nav-mega-menu","scroll-top","sticky-add-to-cart","woo-mod-quantity-overlap","bottom-toolbar"]}],"parent_id":0,"permalink":"https://todookw.com/product/test-demo/","tax_class":"","attributes":[],"backorders":"no","categories":[{"id":62,"name":"Accessories","slug":"accessories"}],"dimensions":{"width":"","height":"","length":""},"menu_order":0,"price_html":"<del aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>10.00&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></del> <span class=\"screen-reader-text\">Original price was: 10.00&nbsp;KWD.</span><ins aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>4.99&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></ins><span class=\"screen-reader-text\">Current price is: 4.99&nbsp;KWD.</span>","sale_price":"4.99","tax_status":"taxable","upsell_ids":[],"variations":[],"backordered":false,"button_text":"","description":"<h3>Cryo facial tools are cooling skincare devices designed to improve skin appearance using cold therapy (cryotherapy). </p>\n<p>These tools are typically made from glass or stainless steel and filled with cooling liquid, allowing them to stay cold for longer durations.</h3>\n<p>They are used by gently gliding over the face to provide a <strong>refreshing massage that helps reduce puffiness, tighten pores, and enhance skin glow</strong>. The cooling effect helps <strong>constrict blood vessels and reduce inflammation</strong>, giving the skin a firmer and more refreshed look.</p>\n","has_options":false,"purchasable":true,"related_ids":[5862,5382,5413,5564,5860],"total_sales":0,"date_created":"2026-04-23T11:30:26","downloadable":false,"external_url":"","manage_stock":false,"rating_count":0,"stock_status":"instock","date_modified":"2026-04-23T11:34:40","post_password":"","purchase_note":"","regular_price":"10","average_rating":"0.00","cross_sell_ids":[],"download_limit":-1,"shipping_class":"","stock_quantity":null,"date_on_sale_to":null,"download_expiry":-1,"reviews_allowed":true,"date_created_gmt":"2026-04-23T08:30:26","global_unique_id":"","grouped_products":[],"low_stock_amount":null,"shipping_taxable":true,"date_modified_gmt":"2026-04-23T08:34:40","date_on_sale_from":null,"shipping_class_id":0,"shipping_required":true,"short_description":"","sold_individually":false,"backorders_allowed":false,"catalog_visibility":"visible","default_attributes":[],"date_on_sale_to_gmt":null,"date_on_sale_from_gmt":null},"synced_at":"2026-04-23T08:37:12.289+00:00","short_description":null}}'::jsonb, '{"ip":"162.159.122.17","path":"/api/stores/a5d4247c-eb2c-4d32-af21-283700e95b23/products/80317759-13b7-4a9a-bcc2-fd35e6da1a60","method":"PUT","woo_id":7146,"store_id":"a5d4247c-eb2c-4d32-af21-283700e95b23","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('e87ee9c6-b817-45eb-8544-94367fe9c531', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '94b41b26-1e6a-4def-a645-5c63246a1c3e', NULL, '{"after":{"id":"94b41b26-1e6a-4def-a645-5c63246a1c3e","code":"aus","amount":26,"woo_id":6440,"raw_data":{"id":6440,"code":"aus","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6440","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:15:42","date_expires":null,"date_modified":"2026-01-27T12:15:42","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:15:42","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:15:42","email_restrictions":[],"exclude_sale_items":false,"product_categories":[60,62,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:15:42+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('f93e9fab-4e41-4d89-90bf-3f334c8342a9', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'bc67a3b9-9a3b-42d5-9f4f-19e5fe3deb7d', NULL, '{"after":{"id":"bc67a3b9-9a3b-42d5-9f4f-19e5fe3deb7d","code":"bbs","amount":26,"woo_id":6439,"raw_data":{"id":6439,"code":"bbs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6439","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:05:56","date_expires":null,"date_modified":"2026-01-27T12:05:56","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:05:56","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:05:56","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:05:56+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('135bf54f-7e08-4fb0-ab8b-55f534ae5a8c', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'cf116b15-7261-4a55-b6c1-eb26ea78e016', NULL, '{"after":{"id":"cf116b15-7261-4a55-b6c1-eb26ea78e016","code":"dbs26","amount":26,"woo_id":6438,"raw_data":{"id":6438,"code":"dbs26","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6438","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:56:24","date_expires":null,"date_modified":"2026-01-27T11:56:24","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:56:24","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:56:24","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:56:24+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('03cb5f22-9e72-42a3-817e-020db5a17460', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '9bd40d9d-f9c4-43dc-953a-3fe165314247', NULL, '{"after":{"id":"9bd40d9d-f9c4-43dc-953a-3fe165314247","code":"ehs","amount":25,"woo_id":6437,"raw_data":{"id":6437,"code":"ehs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6437","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:41:28","date_expires":null,"date_modified":"2026-01-27T11:41:28","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:41:28","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:41:28","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:41:28+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('e9e10fd8-5f7e-479c-98eb-bde375a93cc2', '2026-04-23T08:40:17.187598+00:00', NULL, NULL, 'system', 'product.update', 'product', '80317759-13b7-4a9a-bcc2-fd35e6da1a60', NULL, '{"after":{"status":"pending","raw_data":{"id":7146,"sku":"ertyhgfd","name":"test demo","slug":"test-demo","tags":[],"type":"simple","price":"4.99","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/products/7146","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/products"}]},"brands":[],"images":[],"status":"pending","weight":"0.25","on_sale":true,"virtual":false,"featured":false,"downloads":[],"meta_data":[{"id":79656,"key":"_elementor_page_assets","value":[]}],"parent_id":0,"permalink":"https://todookw.com/?post_type=product&p=7146","tax_class":"","attributes":[],"backorders":"no","categories":[{"id":62,"name":"Accessories","slug":"accessories"}],"dimensions":{"width":"","height":"","length":""},"menu_order":0,"price_html":"<del aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>10.00&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></del> <span class=\"screen-reader-text\">Original price was: 10.00&nbsp;KWD.</span><ins aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>4.99&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></ins><span class=\"screen-reader-text\">Current price is: 4.99&nbsp;KWD.</span>","sale_price":"4.99","tax_status":"taxable","upsell_ids":[],"variations":[],"backordered":false,"button_text":"","description":"<h3>Cryo facial tools are cooling skincare devices designed to improve skin appearance using cold therapy (cryotherapy). </p>\n<p>These tools are typically made from glass or stainless steel and filled with cooling liquid, allowing them to stay cold for longer durations.</h3>\n<p>They are used by gently gliding over the face to provide a <strong>refreshing massage that helps reduce puffiness, tighten pores, and enhance skin glow</strong>. The cooling effect helps <strong>constrict blood vessels and reduce inflammation</strong>, giving the skin a firmer and more refreshed look.</p>\n","has_options":false,"purchasable":true,"related_ids":[2695,5573,2803,5688,5528],"total_sales":0,"date_created":"2026-04-23T11:30:26","downloadable":false,"external_url":"","manage_stock":false,"rating_count":0,"stock_status":"instock","date_modified":"2026-04-23T11:40:16","post_password":"","purchase_note":"","regular_price":"10","average_rating":"0","cross_sell_ids":[],"download_limit":-1,"generated_slug":"test-demo","shipping_class":"","stock_quantity":null,"date_on_sale_to":null,"download_expiry":-1,"reviews_allowed":true,"date_created_gmt":"2026-04-23T08:30:26","global_unique_id":"","grouped_products":[],"low_stock_amount":null,"shipping_taxable":true,"date_modified_gmt":"2026-04-23T08:40:16","date_on_sale_from":null,"shipping_class_id":0,"shipping_required":true,"short_description":"","sold_individually":false,"backorders_allowed":false,"catalog_visibility":"visible","default_attributes":[],"permalink_template":"https://todookw.com/product/%pagename%/","date_on_sale_to_gmt":null,"date_on_sale_from_gmt":null},"synced_at":"2026-04-23T08:40:17.128+00:00"},"before":{"status":"draft","raw_data":{"id":7146,"sku":"ertyhgfd","name":"test demo","slug":"test-demo","tags":[],"type":"simple","price":"4.99","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/products/7146","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/products"}]},"brands":[],"images":[],"status":"draft","weight":"0.25","on_sale":true,"virtual":false,"featured":false,"downloads":[],"meta_data":[{"id":79656,"key":"_elementor_page_assets","value":[]}],"parent_id":0,"permalink":"https://todookw.com/?post_type=product&p=7146","tax_class":"","attributes":[],"backorders":"no","categories":[{"id":62,"name":"Accessories","slug":"accessories"}],"dimensions":{"width":"","height":"","length":""},"menu_order":0,"price_html":"<del aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>10.00&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></del> <span class=\"screen-reader-text\">Original price was: 10.00&nbsp;KWD.</span><ins aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>4.99&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></ins><span class=\"screen-reader-text\">Current price is: 4.99&nbsp;KWD.</span>","sale_price":"4.99","tax_status":"taxable","upsell_ids":[],"variations":[],"backordered":false,"button_text":"","description":"<h3>Cryo facial tools are cooling skincare devices designed to improve skin appearance using cold therapy (cryotherapy). </p>\n<p>These tools are typically made from glass or stainless steel and filled with cooling liquid, allowing them to stay cold for longer durations.</h3>\n<p>They are used by gently gliding over the face to provide a <strong>refreshing massage that helps reduce puffiness, tighten pores, and enhance skin glow</strong>. The cooling effect helps <strong>constrict blood vessels and reduce inflammation</strong>, giving the skin a firmer and more refreshed look.</p>\n","has_options":false,"purchasable":true,"related_ids":[5862,5860,5560,5573,2768],"total_sales":0,"date_created":"2026-04-23T11:30:26","downloadable":false,"external_url":"","manage_stock":false,"rating_count":0,"stock_status":"instock","date_modified":"2026-04-23T11:40:06","post_password":"","purchase_note":"","regular_price":"10","average_rating":"0","cross_sell_ids":[],"download_limit":-1,"generated_slug":"test-demo","shipping_class":"","stock_quantity":null,"date_on_sale_to":null,"download_expiry":-1,"reviews_allowed":true,"date_created_gmt":"2026-04-23T08:30:26","global_unique_id":"","grouped_products":[],"low_stock_amount":null,"shipping_taxable":true,"date_modified_gmt":"2026-04-23T08:40:06","date_on_sale_from":null,"shipping_class_id":0,"shipping_required":true,"short_description":"","sold_individually":false,"backorders_allowed":false,"catalog_visibility":"visible","default_attributes":[],"permalink_template":"https://todookw.com/product/%pagename%/","date_on_sale_to_gmt":null,"date_on_sale_from_gmt":null},"synced_at":"2026-04-23T08:40:07.016+00:00"}}'::jsonb, '{"ip":"162.159.122.16","path":"/api/stores/a5d4247c-eb2c-4d32-af21-283700e95b23/products/80317759-13b7-4a9a-bcc2-fd35e6da1a60","method":"PUT","woo_id":7146,"store_id":"a5d4247c-eb2c-4d32-af21-283700e95b23","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('6fd724e9-8a81-4b01-a322-781ad9fd0c59', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'de55e9e1-0a56-435b-9e09-9614019a5fd3', NULL, '{"after":{"id":"de55e9e1-0a56-435b-9e09-9614019a5fd3","code":"fhs","amount":20,"woo_id":6436,"raw_data":{"id":6436,"code":"fhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6436","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"20.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:36:41","date_expires":null,"date_modified":"2026-01-27T11:36:41","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:36:41","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:36:41","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:36:41+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('56a658c4-84ac-40a2-a176-cdc2d7b4205b', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'df296bf0-6c2b-4b61-8b0a-2004a8b77987', NULL, '{"after":{"id":"df296bf0-6c2b-4b61-8b0a-2004a8b77987","code":"sas","amount":26,"woo_id":6435,"raw_data":{"id":6435,"code":"sas","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6435","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:26:45","date_expires":null,"date_modified":"2026-01-27T11:26:45","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:26:45","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:26:45","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:26:45+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('697b2ad6-6266-41df-878f-82ca2c988e5a', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '53b7bab2-8be6-4ed1-a741-1cc26c6d2a6d', NULL, '{"after":{"id":"53b7bab2-8be6-4ed1-a741-1cc26c6d2a6d","code":"qhs","amount":30,"woo_id":6434,"raw_data":{"id":6434,"code":"qhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6434","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:23:45","date_expires":null,"date_modified":"2026-01-27T11:23:45","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:23:45","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:23:45","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:23:45+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('1231d406-eb30-4038-972c-5abf4d3f7315', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'c407a4ce-bec5-4b9d-890d-52fa7f8dde6f', NULL, '{"after":{"id":"c407a4ce-bec5-4b9d-890d-52fa7f8dde6f","code":"sarwai","amount":22,"woo_id":6433,"raw_data":{"id":6433,"code":"sarwai","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6433","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"22.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:20:25","date_expires":null,"date_modified":"2026-01-27T11:20:25","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:20:25","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:20:25","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,115,92,116,103],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:20:25+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('6e4d2ce4-1e58-4a4b-a067-0fca9b92a1c8', '2026-04-23T08:40:26.048154+00:00', NULL, NULL, 'system', 'product.update', 'product', '80317759-13b7-4a9a-bcc2-fd35e6da1a60', NULL, '{"after":{"status":"private","raw_data":{"id":7146,"sku":"ertyhgfd","name":"test demo","slug":"test-demo","tags":[],"type":"simple","price":"4.99","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/products/7146","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/products"}]},"brands":[],"images":[],"status":"private","weight":"0.25","on_sale":true,"virtual":false,"featured":false,"downloads":[],"meta_data":[{"id":79656,"key":"_elementor_page_assets","value":[]}],"parent_id":0,"permalink":"https://todookw.com/product/test-demo/","tax_class":"","attributes":[],"backorders":"no","categories":[{"id":62,"name":"Accessories","slug":"accessories"}],"dimensions":{"width":"","height":"","length":""},"menu_order":0,"price_html":"<del aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>10.00&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></del> <span class=\"screen-reader-text\">Original price was: 10.00&nbsp;KWD.</span><ins aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>4.99&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></ins><span class=\"screen-reader-text\">Current price is: 4.99&nbsp;KWD.</span>","sale_price":"4.99","tax_status":"taxable","upsell_ids":[],"variations":[],"backordered":false,"button_text":"","description":"<h3>Cryo facial tools are cooling skincare devices designed to improve skin appearance using cold therapy (cryotherapy). </p>\n<p>These tools are typically made from glass or stainless steel and filled with cooling liquid, allowing them to stay cold for longer durations.</h3>\n<p>They are used by gently gliding over the face to provide a <strong>refreshing massage that helps reduce puffiness, tighten pores, and enhance skin glow</strong>. The cooling effect helps <strong>constrict blood vessels and reduce inflammation</strong>, giving the skin a firmer and more refreshed look.</p>\n","has_options":false,"purchasable":true,"related_ids":[5573,6283,5688,5578,5467],"total_sales":0,"date_created":"2026-04-23T11:30:26","downloadable":false,"external_url":"","manage_stock":false,"rating_count":0,"stock_status":"instock","date_modified":"2026-04-23T11:40:25","post_password":"","purchase_note":"","regular_price":"10","average_rating":"0","cross_sell_ids":[],"download_limit":-1,"generated_slug":"test-demo","shipping_class":"","stock_quantity":null,"date_on_sale_to":null,"download_expiry":-1,"reviews_allowed":true,"date_created_gmt":"2026-04-23T08:30:26","global_unique_id":"","grouped_products":[],"low_stock_amount":null,"shipping_taxable":true,"date_modified_gmt":"2026-04-23T08:40:25","date_on_sale_from":null,"shipping_class_id":0,"shipping_required":true,"short_description":"","sold_individually":false,"backorders_allowed":false,"catalog_visibility":"visible","default_attributes":[],"permalink_template":"https://todookw.com/product/%pagename%/","date_on_sale_to_gmt":null,"date_on_sale_from_gmt":null},"synced_at":"2026-04-23T08:40:25.973+00:00"},"before":{"status":"pending","raw_data":{"id":7146,"sku":"ertyhgfd","name":"test demo","slug":"test-demo","tags":[],"type":"simple","price":"4.99","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/products/7146","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/products"}]},"brands":[],"images":[],"status":"pending","weight":"0.25","on_sale":true,"virtual":false,"featured":false,"downloads":[],"meta_data":[{"id":79656,"key":"_elementor_page_assets","value":[]}],"parent_id":0,"permalink":"https://todookw.com/?post_type=product&p=7146","tax_class":"","attributes":[],"backorders":"no","categories":[{"id":62,"name":"Accessories","slug":"accessories"}],"dimensions":{"width":"","height":"","length":""},"menu_order":0,"price_html":"<del aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>10.00&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></del> <span class=\"screen-reader-text\">Original price was: 10.00&nbsp;KWD.</span><ins aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>4.99&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></ins><span class=\"screen-reader-text\">Current price is: 4.99&nbsp;KWD.</span>","sale_price":"4.99","tax_status":"taxable","upsell_ids":[],"variations":[],"backordered":false,"button_text":"","description":"<h3>Cryo facial tools are cooling skincare devices designed to improve skin appearance using cold therapy (cryotherapy). </p>\n<p>These tools are typically made from glass or stainless steel and filled with cooling liquid, allowing them to stay cold for longer durations.</h3>\n<p>They are used by gently gliding over the face to provide a <strong>refreshing massage that helps reduce puffiness, tighten pores, and enhance skin glow</strong>. The cooling effect helps <strong>constrict blood vessels and reduce inflammation</strong>, giving the skin a firmer and more refreshed look.</p>\n","has_options":false,"purchasable":true,"related_ids":[2695,5573,2803,5688,5528],"total_sales":0,"date_created":"2026-04-23T11:30:26","downloadable":false,"external_url":"","manage_stock":false,"rating_count":0,"stock_status":"instock","date_modified":"2026-04-23T11:40:16","post_password":"","purchase_note":"","regular_price":"10","average_rating":"0","cross_sell_ids":[],"download_limit":-1,"generated_slug":"test-demo","shipping_class":"","stock_quantity":null,"date_on_sale_to":null,"download_expiry":-1,"reviews_allowed":true,"date_created_gmt":"2026-04-23T08:30:26","global_unique_id":"","grouped_products":[],"low_stock_amount":null,"shipping_taxable":true,"date_modified_gmt":"2026-04-23T08:40:16","date_on_sale_from":null,"shipping_class_id":0,"shipping_required":true,"short_description":"","sold_individually":false,"backorders_allowed":false,"catalog_visibility":"visible","default_attributes":[],"permalink_template":"https://todookw.com/product/%pagename%/","date_on_sale_to_gmt":null,"date_on_sale_from_gmt":null},"synced_at":"2026-04-23T08:40:17.128+00:00"}}'::jsonb, '{"ip":"162.159.122.16","path":"/api/stores/a5d4247c-eb2c-4d32-af21-283700e95b23/products/80317759-13b7-4a9a-bcc2-fd35e6da1a60","method":"PUT","woo_id":7146,"store_id":"a5d4247c-eb2c-4d32-af21-283700e95b23","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('98006601-1693-4a53-9598-4d79b316ce8e', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '24c3d84c-0cc3-4d43-a1f4-169daff7e0ef', NULL, '{"after":{"id":"24c3d84c-0cc3-4d43-a1f4-169daff7e0ef","code":"aba","amount":33,"woo_id":6432,"raw_data":{"id":6432,"code":"aba","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6432","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"33.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:15:57","date_expires":null,"date_modified":"2026-01-27T11:15:57","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:15:57","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:15:57","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:15:57+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('4811b641-1915-4eea-9f75-c57bde9b2c61', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '5e82ce5f-f914-4821-9c31-0de883a49ebe', NULL, '{"after":{"id":"5e82ce5f-f914-4821-9c31-0de883a49ebe","code":"mhs","amount":30,"woo_id":6431,"raw_data":{"id":6431,"code":"mhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6431","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:11:05","date_expires":null,"date_modified":"2026-01-27T11:11:05","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:11:05","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:11:05","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:11:05+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('189838e1-dec1-41ff-83cb-0fbc1d412ad2', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '090f1614-e600-4f6d-b774-a2fc1bb6df47', NULL, '{"after":{"id":"090f1614-e600-4f6d-b774-a2fc1bb6df47","code":"bibi","amount":24,"woo_id":6430,"raw_data":{"id":6430,"code":"bibi","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6430","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"24.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:04:48","date_expires":null,"date_modified":"2026-01-27T11:04:48","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T08:04:48","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T08:04:48","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,115,79,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T11:04:48+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('2987035a-cbb5-4aa2-b786-f3c36b5e6302', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'd0d194a5-3d92-481a-92a7-5017c6e7ae5a', NULL, '{"after":{"id":"d0d194a5-3d92-481a-92a7-5017c6e7ae5a","code":"bhs","amount":26,"woo_id":6429,"raw_data":{"id":6429,"code":"bhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6429","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:59:56","date_expires":null,"date_modified":"2026-01-27T10:59:56","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:59:56","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:59:56","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:59:56+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('4f038710-0919-4331-9e4b-aac1d295b1f8', '2026-04-23T08:40:36.732344+00:00', NULL, NULL, 'system', 'product.update', 'product', '80317759-13b7-4a9a-bcc2-fd35e6da1a60', NULL, '{"after":{"status":"publish","raw_data":{"id":7146,"sku":"ertyhgfd","name":"test demo","slug":"test-demo","tags":[],"type":"simple","price":"4.99","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/products/7146","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/products"}]},"brands":[],"images":[],"status":"publish","weight":"0.25","on_sale":true,"virtual":false,"featured":false,"downloads":[],"meta_data":[{"id":79656,"key":"_elementor_page_assets","value":[]}],"parent_id":0,"permalink":"https://todookw.com/product/test-demo/","tax_class":"","attributes":[],"backorders":"no","categories":[{"id":62,"name":"Accessories","slug":"accessories"}],"dimensions":{"width":"","height":"","length":""},"menu_order":0,"price_html":"<del aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>10.00&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></del> <span class=\"screen-reader-text\">Original price was: 10.00&nbsp;KWD.</span><ins aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>4.99&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></ins><span class=\"screen-reader-text\">Current price is: 4.99&nbsp;KWD.</span>","sale_price":"4.99","tax_status":"taxable","upsell_ids":[],"variations":[],"backordered":false,"button_text":"","description":"<h3>Cryo facial tools are cooling skincare devices designed to improve skin appearance using cold therapy (cryotherapy). </p>\n<p>These tools are typically made from glass or stainless steel and filled with cooling liquid, allowing them to stay cold for longer durations.</h3>\n<p>They are used by gently gliding over the face to provide a <strong>refreshing massage that helps reduce puffiness, tighten pores, and enhance skin glow</strong>. The cooling effect helps <strong>constrict blood vessels and reduce inflammation</strong>, giving the skin a firmer and more refreshed look.</p>\n","has_options":false,"purchasable":true,"related_ids":[5573,5858,5528,5384,2443],"total_sales":0,"date_created":"2026-04-23T11:30:26","downloadable":false,"external_url":"","manage_stock":false,"rating_count":0,"stock_status":"instock","date_modified":"2026-04-23T11:40:36","post_password":"","purchase_note":"","regular_price":"10","average_rating":"0","cross_sell_ids":[],"download_limit":-1,"generated_slug":"test-demo","shipping_class":"","stock_quantity":null,"date_on_sale_to":null,"download_expiry":-1,"reviews_allowed":true,"date_created_gmt":"2026-04-23T08:30:26","global_unique_id":"","grouped_products":[],"low_stock_amount":null,"shipping_taxable":true,"date_modified_gmt":"2026-04-23T08:40:36","date_on_sale_from":null,"shipping_class_id":0,"shipping_required":true,"short_description":"","sold_individually":false,"backorders_allowed":false,"catalog_visibility":"visible","default_attributes":[],"permalink_template":"https://todookw.com/product/%pagename%/","date_on_sale_to_gmt":null,"date_on_sale_from_gmt":null},"synced_at":"2026-04-23T08:40:36.653+00:00","short_description":""},"before":{"status":"private","raw_data":{"id":7146,"sku":"ertyhgfd","name":"test demo","slug":"test-demo","tags":[],"type":"simple","price":"4.99","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/products/7146","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/products"}]},"brands":[],"images":[],"status":"private","weight":"0.25","on_sale":true,"virtual":false,"featured":false,"downloads":[],"meta_data":[{"id":79656,"key":"_elementor_page_assets","value":[]}],"parent_id":0,"permalink":"https://todookw.com/product/test-demo/","tax_class":"","attributes":[],"backorders":"no","categories":[{"id":62,"name":"Accessories","slug":"accessories"}],"dimensions":{"width":"","height":"","length":""},"menu_order":0,"price_html":"<del aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>10.00&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></del> <span class=\"screen-reader-text\">Original price was: 10.00&nbsp;KWD.</span><ins aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>4.99&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></ins><span class=\"screen-reader-text\">Current price is: 4.99&nbsp;KWD.</span>","sale_price":"4.99","tax_status":"taxable","upsell_ids":[],"variations":[],"backordered":false,"button_text":"","description":"<h3>Cryo facial tools are cooling skincare devices designed to improve skin appearance using cold therapy (cryotherapy). </p>\n<p>These tools are typically made from glass or stainless steel and filled with cooling liquid, allowing them to stay cold for longer durations.</h3>\n<p>They are used by gently gliding over the face to provide a <strong>refreshing massage that helps reduce puffiness, tighten pores, and enhance skin glow</strong>. The cooling effect helps <strong>constrict blood vessels and reduce inflammation</strong>, giving the skin a firmer and more refreshed look.</p>\n","has_options":false,"purchasable":true,"related_ids":[5564,2441,5419,5578,2803],"total_sales":0,"date_created":"2026-04-23T11:30:26","downloadable":false,"external_url":"","manage_stock":false,"rating_count":0,"stock_status":"instock","date_modified":"2026-04-23T11:40:25","post_password":"","purchase_note":"","regular_price":"10","average_rating":"0.00","cross_sell_ids":[],"download_limit":-1,"shipping_class":"","stock_quantity":null,"date_on_sale_to":null,"download_expiry":-1,"reviews_allowed":true,"date_created_gmt":"2026-04-23T08:30:26","global_unique_id":"","grouped_products":[],"low_stock_amount":null,"shipping_taxable":true,"date_modified_gmt":"2026-04-23T08:40:25","date_on_sale_from":null,"shipping_class_id":0,"shipping_required":true,"short_description":"","sold_individually":false,"backorders_allowed":false,"catalog_visibility":"visible","default_attributes":[],"date_on_sale_to_gmt":null,"date_on_sale_from_gmt":null},"synced_at":"2026-04-23T08:40:29.861+00:00","short_description":null}}'::jsonb, '{"ip":"162.159.122.16","path":"/api/stores/a5d4247c-eb2c-4d32-af21-283700e95b23/products/80317759-13b7-4a9a-bcc2-fd35e6da1a60","method":"PUT","woo_id":7146,"store_id":"a5d4247c-eb2c-4d32-af21-283700e95b23","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('56e61bdf-bf72-4a9e-a751-15919bf834ae', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'a040fff5-4d6b-4f72-a229-61e87a082fae', NULL, '{"after":{"id":"a040fff5-4d6b-4f72-a229-61e87a082fae","code":"aca","amount":25,"woo_id":6428,"raw_data":{"id":6428,"code":"aca","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6428","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:57:00","date_expires":null,"date_modified":"2026-01-27T10:57:00","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:57:00","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:57:00","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:57:00+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('6bb621e0-d2b6-49c8-817f-90ff71e7eb04', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '9dfc875d-0233-4d80-a027-ec7e9fd89c53', NULL, '{"after":{"id":"9dfc875d-0233-4d80-a027-ec7e9fd89c53","code":"obb","amount":15,"woo_id":6427,"raw_data":{"id":6427,"code":"obb","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6427","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"15.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:52:44","date_expires":null,"date_modified":"2026-01-27T10:52:44","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:52:44","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:52:44","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:52:44+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('0fe0875e-1264-4dbc-9575-4d33db3ed985', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '16f8fae5-083c-4ba6-b489-c7f1438e3480', NULL, '{"after":{"id":"16f8fae5-083c-4ba6-b489-c7f1438e3480","code":"25feb","amount":25,"woo_id":6426,"raw_data":{"id":6426,"code":"25feb","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6426","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:41:46","date_expires":null,"date_modified":"2026-01-27T10:41:46","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:41:46","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:41:46","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:41:46+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('8f16c835-cbab-496b-b167-14b5668b53a9', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '80f89e9f-d198-42eb-8d10-320a2f5bcc41', NULL, '{"after":{"id":"80f89e9f-d198-42eb-8d10-320a2f5bcc41","code":"rss","amount":30,"woo_id":6425,"raw_data":{"id":6425,"code":"rss","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6425","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:37:01","date_expires":null,"date_modified":"2026-01-27T10:37:01","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:37:01","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:37:01","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:37:01+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('5cdbbd58-7016-46e0-957f-993ec1f57bde', '2026-04-23T08:40:50.530458+00:00', NULL, NULL, 'system', 'product.update', 'product', '80317759-13b7-4a9a-bcc2-fd35e6da1a60', NULL, '{"after":{"status":"private","raw_data":{"id":7146,"sku":"ertyhgfd","name":"test demo","slug":"test-demo","tags":[],"type":"simple","price":"4.99","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/products/7146","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/products"}]},"brands":[],"images":[],"status":"private","weight":"0.25","on_sale":true,"virtual":false,"featured":false,"downloads":[],"meta_data":[{"id":79656,"key":"_elementor_page_assets","value":[]}],"parent_id":0,"permalink":"https://todookw.com/product/test-demo/","tax_class":"","attributes":[],"backorders":"no","categories":[{"id":62,"name":"Accessories","slug":"accessories"}],"dimensions":{"width":"","height":"","length":""},"menu_order":0,"price_html":"<del aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>10.00&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></del> <span class=\"screen-reader-text\">Original price was: 10.00&nbsp;KWD.</span><ins aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>4.99&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></ins><span class=\"screen-reader-text\">Current price is: 4.99&nbsp;KWD.</span>","sale_price":"4.99","tax_status":"taxable","upsell_ids":[],"variations":[],"backordered":false,"button_text":"","description":"<h3>Cryo facial tools are cooling skincare devices designed to improve skin appearance using cold therapy (cryotherapy). </p>\n<p>These tools are typically made from glass or stainless steel and filled with cooling liquid, allowing them to stay cold for longer durations.</h3>\n<p>They are used by gently gliding over the face to provide a <strong>refreshing massage that helps reduce puffiness, tighten pores, and enhance skin glow</strong>. The cooling effect helps <strong>constrict blood vessels and reduce inflammation</strong>, giving the skin a firmer and more refreshed look.</p>\n","has_options":false,"purchasable":true,"related_ids":[5382,5409,5560,2438,5564],"total_sales":0,"date_created":"2026-04-23T11:30:26","downloadable":false,"external_url":"","manage_stock":false,"rating_count":0,"stock_status":"instock","date_modified":"2026-04-23T11:40:50","post_password":"","purchase_note":"","regular_price":"10","average_rating":"0","cross_sell_ids":[],"download_limit":-1,"generated_slug":"test-demo","shipping_class":"","stock_quantity":null,"date_on_sale_to":null,"download_expiry":-1,"reviews_allowed":true,"date_created_gmt":"2026-04-23T08:30:26","global_unique_id":"","grouped_products":[],"low_stock_amount":null,"shipping_taxable":true,"date_modified_gmt":"2026-04-23T08:40:50","date_on_sale_from":null,"shipping_class_id":0,"shipping_required":true,"short_description":"","sold_individually":false,"backorders_allowed":false,"catalog_visibility":"visible","default_attributes":[],"permalink_template":"https://todookw.com/product/%pagename%/","date_on_sale_to_gmt":null,"date_on_sale_from_gmt":null},"synced_at":"2026-04-23T08:40:50.498+00:00"},"before":{"status":"publish","raw_data":{"id":7146,"sku":"ertyhgfd","name":"test demo","slug":"test-demo","tags":[],"type":"simple","price":"4.99","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/products/7146","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/products"}]},"brands":[],"images":[],"status":"publish","weight":"0.25","on_sale":true,"virtual":false,"featured":false,"downloads":[],"meta_data":[{"id":79656,"key":"_elementor_page_assets","value":[]}],"parent_id":0,"permalink":"https://todookw.com/product/test-demo/","tax_class":"","attributes":[],"backorders":"no","categories":[{"id":62,"name":"Accessories","slug":"accessories"}],"dimensions":{"width":"","height":"","length":""},"menu_order":0,"price_html":"<del aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>10.00&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></del> <span class=\"screen-reader-text\">Original price was: 10.00&nbsp;KWD.</span><ins aria-hidden=\"true\"><span class=\"woocommerce-Price-amount amount\"><bdi>4.99&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span></ins><span class=\"screen-reader-text\">Current price is: 4.99&nbsp;KWD.</span>","sale_price":"4.99","tax_status":"taxable","upsell_ids":[],"variations":[],"backordered":false,"button_text":"","description":"<h3>Cryo facial tools are cooling skincare devices designed to improve skin appearance using cold therapy (cryotherapy). </p>\n<p>These tools are typically made from glass or stainless steel and filled with cooling liquid, allowing them to stay cold for longer durations.</h3>\n<p>They are used by gently gliding over the face to provide a <strong>refreshing massage that helps reduce puffiness, tighten pores, and enhance skin glow</strong>. The cooling effect helps <strong>constrict blood vessels and reduce inflammation</strong>, giving the skin a firmer and more refreshed look.</p>\n","has_options":false,"purchasable":true,"related_ids":[5573,5858,5528,5384,2443],"total_sales":0,"date_created":"2026-04-23T11:30:26","downloadable":false,"external_url":"","manage_stock":false,"rating_count":0,"stock_status":"instock","date_modified":"2026-04-23T11:40:36","post_password":"","purchase_note":"","regular_price":"10","average_rating":"0","cross_sell_ids":[],"download_limit":-1,"generated_slug":"test-demo","shipping_class":"","stock_quantity":null,"date_on_sale_to":null,"download_expiry":-1,"reviews_allowed":true,"date_created_gmt":"2026-04-23T08:30:26","global_unique_id":"","grouped_products":[],"low_stock_amount":null,"shipping_taxable":true,"date_modified_gmt":"2026-04-23T08:40:36","date_on_sale_from":null,"shipping_class_id":0,"shipping_required":true,"short_description":"","sold_individually":false,"backorders_allowed":false,"catalog_visibility":"visible","default_attributes":[],"permalink_template":"https://todookw.com/product/%pagename%/","date_on_sale_to_gmt":null,"date_on_sale_from_gmt":null},"synced_at":"2026-04-23T08:40:36.653+00:00"}}'::jsonb, '{"ip":"162.159.122.16","path":"/api/stores/a5d4247c-eb2c-4d32-af21-283700e95b23/products/80317759-13b7-4a9a-bcc2-fd35e6da1a60","method":"PUT","woo_id":7146,"store_id":"a5d4247c-eb2c-4d32-af21-283700e95b23","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('eaac4a26-d088-4a55-9551-2b7cbdeeed88', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '9557ab83-9415-447d-813d-7a1b5521cb14', NULL, '{"after":{"id":"9557ab83-9415-447d-813d-7a1b5521cb14","code":"hubs","amount":35,"woo_id":6424,"raw_data":{"id":6424,"code":"hubs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6424","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"35.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:34:22","date_expires":null,"date_modified":"2026-01-27T10:34:22","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:34:22","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:34:22","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,115,92,103,116,79],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T10:34:22+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('c0450d9b-945a-4827-849a-ee1552783883', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'f9189715-6240-4cb9-ab11-164143068531', NULL, '{"after":{"id":"f9189715-6240-4cb9-ab11-164143068531","code":"aou","amount":26,"woo_id":6421,"raw_data":{"id":6421,"code":"aou","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6421","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":["1148"],"meta_data":[{"id":62780,"key":"sa_cbl_locations_lookup_in","value":{"address":"billing"}},{"id":62794,"key":"sc_restrict_to_new_user","value":"no"},{"id":62795,"key":"auto_generate_coupon","value":"no"},{"id":62796,"key":"coupon_title_prefix","value":""},{"id":62797,"key":"coupon_title_suffix","value":""},{"id":62798,"key":"sc_coupon_validity","value":""},{"id":62799,"key":"validity_suffix","value":"days"},{"id":62800,"key":"sc_is_visible_storewide","value":"no"},{"id":62801,"key":"sc_disable_email_restriction","value":"no"},{"id":62802,"key":"is_pick_price_of_product","value":"no"},{"id":62803,"key":"wc_sc_add_product_details","value":[]},{"id":62804,"key":"wc_sc_max_discount","value":""},{"id":62805,"key":"wc_sc_expiry_time","value":""},{"id":62806,"key":"wc_sc_auto_apply_coupon","value":"no"},{"id":62807,"key":"sa_cbl_billing_locations","value":[]},{"id":62808,"key":"wc_sc_payment_method_ids","value":[]},{"id":62809,"key":"wc_sc_shipping_method_ids","value":[]},{"id":62810,"key":"wc_sc_user_role_ids","value":[]},{"id":62811,"key":"wc_sc_exclude_user_role_ids","value":[]},{"id":62812,"key":"wc_sc_product_attribute_ids","value":""},{"id":62813,"key":"wc_sc_exclude_product_attribute_ids","value":""},{"id":62814,"key":"wc_sc_taxonomy_restrictions","value":[]},{"id":62815,"key":"wc_sc_excluded_customer_email","value":[]},{"id":62816,"key":"wc_coupon_message","value":""},{"id":62817,"key":"wc_email_message","value":"no"},{"id":62818,"key":"wc_sc_product_quantity_restrictions","value":{"type":"cart","values":{"cart":{"max":"","min":""},"product":[],"product_category":[]},"condition":"any"}},{"id":62819,"key":"wc_sc_cheapest_costliest_settings","value":"1_"},{"id":62820,"key":"product_brands","value":[]},{"id":62821,"key":"exclude_product_brands","value":[]}],"description":"35% Discount","product_ids":[],"usage_count":1,"usage_limit":180,"date_created":"2026-01-27T10:34:12","date_expires":null,"date_modified":"2026-01-27T10:48:46","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T07:34:12","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T07:48:46","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":1,"limit_usage_to_x_items":null,"excluded_product_categories":[70,146]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"35% Discount","product_ids":[],"usage_count":1,"usage_limit":180,"date_created":"2026-01-27T10:34:12+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":1}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('ee700fd0-faaa-40be-99ec-5b8f9acf09bf', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '4e3e43ed-5bf3-461b-9f9e-0e443ba0fa66', NULL, '{"after":{"id":"4e3e43ed-5bf3-461b-9f9e-0e443ba0fa66","code":"phx","amount":30,"woo_id":6009,"raw_data":{"id":6009,"code":"phx","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6009","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[{"id":58717,"key":"sa_cbl_locations_lookup_in","value":{"address":"billing"}},{"id":58718,"key":"sc_restrict_to_new_user","value":"no"},{"id":58719,"key":"auto_generate_coupon","value":"no"},{"id":58720,"key":"coupon_title_prefix","value":""},{"id":58721,"key":"coupon_title_suffix","value":""},{"id":58722,"key":"sc_coupon_validity","value":""},{"id":58723,"key":"validity_suffix","value":"days"},{"id":58724,"key":"sc_is_visible_storewide","value":"no"},{"id":58725,"key":"sc_disable_email_restriction","value":"no"},{"id":58726,"key":"is_pick_price_of_product","value":"no"},{"id":58727,"key":"wc_sc_add_product_details","value":[]},{"id":58728,"key":"wc_sc_max_discount","value":""},{"id":58729,"key":"wc_sc_expiry_time","value":""},{"id":58730,"key":"wc_sc_auto_apply_coupon","value":"no"},{"id":58731,"key":"sa_cbl_billing_locations","value":[]},{"id":58732,"key":"wc_sc_payment_method_ids","value":[]},{"id":58733,"key":"wc_sc_shipping_method_ids","value":[]},{"id":58734,"key":"wc_sc_user_role_ids","value":[]},{"id":58735,"key":"wc_sc_exclude_user_role_ids","value":[]},{"id":58736,"key":"wc_sc_product_attribute_ids","value":""},{"id":58737,"key":"wc_sc_exclude_product_attribute_ids","value":""},{"id":58738,"key":"wc_sc_taxonomy_restrictions","value":[]},{"id":58739,"key":"wc_sc_excluded_customer_email","value":[]},{"id":58740,"key":"wc_coupon_message","value":""},{"id":58741,"key":"wc_email_message","value":"no"},{"id":58742,"key":"wc_sc_product_quantity_restrictions","value":{"type":"cart","values":{"cart":{"max":"","min":""},"product":[],"product_category":[]},"condition":"any"}},{"id":58743,"key":"wc_sc_cheapest_costliest_settings","value":"1_"},{"id":58744,"key":"product_brands","value":[]},{"id":58745,"key":"exclude_product_brands","value":[]}],"description":"30% off on bags","product_ids":[],"usage_count":0,"usage_limit":20,"date_created":"2025-12-03T11:42:37","date_expires":"2026-01-04T00:00:00","date_modified":"2025-12-03T21:34:14","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2025-12-03T08:42:37","date_expires_gmt":"2026-01-03T21:00:00","date_modified_gmt":"2025-12-03T18:34:14","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":1,"limit_usage_to_x_items":null,"excluded_product_categories":[62,146,70]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"30% off on bags","product_ids":[],"usage_count":0,"usage_limit":20,"date_created":"2025-12-03T11:42:37+00:00","date_expires":"2026-01-04T00:00:00+00:00","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":1}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('9c9fdd2c-7f0e-4810-bd6e-a54e50baf12d', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'e09087ac-a0c4-427e-847d-1b58825f48b8', NULL, '{"after":{"id":"e09087ac-a0c4-427e-847d-1b58825f48b8","code":"iuk","amount":30,"woo_id":5956,"raw_data":{"id":5956,"code":"iuk","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/5956","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[{"id":58129,"key":"sa_cbl_locations_lookup_in","value":{"address":"billing"}},{"id":58144,"key":"sc_restrict_to_new_user","value":"no"},{"id":58145,"key":"auto_generate_coupon","value":"no"},{"id":58146,"key":"coupon_title_prefix","value":""},{"id":58147,"key":"coupon_title_suffix","value":""},{"id":58148,"key":"sc_coupon_validity","value":""},{"id":58149,"key":"validity_suffix","value":"days"},{"id":58150,"key":"sc_is_visible_storewide","value":"no"},{"id":58151,"key":"sc_disable_email_restriction","value":"no"},{"id":58152,"key":"is_pick_price_of_product","value":"no"},{"id":58153,"key":"wc_sc_add_product_details","value":[]},{"id":58154,"key":"wc_sc_max_discount","value":""},{"id":58155,"key":"wc_sc_expiry_time","value":""},{"id":58156,"key":"wc_sc_auto_apply_coupon","value":"no"},{"id":58157,"key":"sa_cbl_billing_locations","value":[]},{"id":58158,"key":"wc_sc_payment_method_ids","value":[]},{"id":58159,"key":"wc_sc_shipping_method_ids","value":[]},{"id":58160,"key":"wc_sc_user_role_ids","value":[]},{"id":58161,"key":"wc_sc_exclude_user_role_ids","value":[]},{"id":58162,"key":"wc_sc_product_attribute_ids","value":""},{"id":58163,"key":"wc_sc_exclude_product_attribute_ids","value":""},{"id":58164,"key":"wc_sc_taxonomy_restrictions","value":[]},{"id":58165,"key":"wc_sc_excluded_customer_email","value":[]},{"id":58166,"key":"wc_coupon_message","value":""},{"id":58167,"key":"wc_email_message","value":"no"},{"id":58168,"key":"wc_sc_product_quantity_restrictions","value":{"type":"cart","values":{"cart":{"max":"","min":""},"product":[],"product_category":[]},"condition":"any"}},{"id":58169,"key":"wc_sc_cheapest_costliest_settings","value":"1_"},{"id":58170,"key":"product_brands","value":[]},{"id":58171,"key":"exclude_product_brands","value":[]}],"description":"30% off on bags","product_ids":[],"usage_count":0,"usage_limit":20,"date_created":"2025-11-26T10:29:13","date_expires":"2025-12-20T00:00:00","date_modified":"2025-11-26T11:09:24","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2025-11-26T07:29:13","date_expires_gmt":"2025-12-19T21:00:00","date_modified_gmt":"2025-11-26T08:09:24","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":1,"limit_usage_to_x_items":null,"excluded_product_categories":[62,146,70]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"30% off on bags","product_ids":[],"usage_count":0,"usage_limit":20,"date_created":"2025-11-26T10:29:13+00:00","date_expires":"2025-12-20T00:00:00+00:00","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":1}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('f43801d4-02d4-4a1a-b221-6357ac0da400', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'eb76e3fb-7b15-4350-8dd3-33f061faaedd', NULL, '{"after":{"id":"eb76e3fb-7b15-4350-8dd3-33f061faaedd","code":"freeship","amount":0,"woo_id":5378,"raw_data":{"id":5378,"code":"freeship","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/5378","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"0.00","status":"publish","used_by":["873","963","1011","1011","963","963","1035","1011","1067","1011","963","1127","1167","1035","1109"],"meta_data":[{"id":50503,"key":"sa_cbl_locations_lookup_in","value":{"address":"billing"}},{"id":50516,"key":"sc_restrict_to_new_user","value":"no"},{"id":50517,"key":"auto_generate_coupon","value":"no"},{"id":50518,"key":"coupon_title_prefix","value":""},{"id":50519,"key":"coupon_title_suffix","value":""},{"id":50520,"key":"sc_coupon_validity","value":""},{"id":50521,"key":"validity_suffix","value":"days"},{"id":50522,"key":"sc_is_visible_storewide","value":"no"},{"id":50523,"key":"sc_disable_email_restriction","value":"no"},{"id":50524,"key":"is_pick_price_of_product","value":"no"},{"id":50525,"key":"wc_sc_add_product_details","value":[]},{"id":50526,"key":"wc_sc_max_discount","value":""},{"id":50527,"key":"wc_sc_expiry_time","value":""},{"id":50528,"key":"wc_sc_auto_apply_coupon","value":"no"},{"id":50529,"key":"sa_cbl_billing_locations","value":[]},{"id":50530,"key":"wc_sc_payment_method_ids","value":[]},{"id":50531,"key":"wc_sc_shipping_method_ids","value":[]},{"id":50532,"key":"wc_sc_user_role_ids","value":[]},{"id":50533,"key":"wc_sc_exclude_user_role_ids","value":[]},{"id":50534,"key":"wc_sc_product_attribute_ids","value":""},{"id":50535,"key":"wc_sc_exclude_product_attribute_ids","value":""},{"id":50536,"key":"wc_sc_taxonomy_restrictions","value":[]},{"id":50537,"key":"wc_sc_excluded_customer_email","value":[]},{"id":50538,"key":"wc_coupon_message","value":""},{"id":50539,"key":"wc_email_message","value":"no"},{"id":50540,"key":"wc_sc_product_quantity_restrictions","value":{"type":"cart","values":{"cart":{"max":"","min":""},"product":[],"product_category":[]},"condition":"any"}},{"id":50541,"key":"wc_sc_cheapest_costliest_settings","value":"1_"},{"id":50542,"key":"product_brands","value":[]},{"id":50543,"key":"exclude_product_brands","value":[]}],"description":"","product_ids":[],"usage_count":15,"usage_limit":null,"date_created":"2025-07-30T10:48:50","date_expires":null,"date_modified":"2025-07-30T10:53:00","discount_type":"fixed_cart","free_shipping":true,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2025-07-30T07:48:50","date_expires_gmt":null,"date_modified_gmt":"2025-07-30T07:53:00","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":15,"usage_limit":null,"date_created":"2025-07-30T10:48:50+00:00","date_expires":null,"discount_type":"fixed_cart","free_shipping":true,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('152eee1e-8635-450a-92df-cf741fe3c697', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '1d763cf9-de8c-4478-b23e-b4d668444321', NULL, '{"after":{"id":"1d763cf9-de8c-4478-b23e-b4d668444321","code":"todoo","amount":10,"woo_id":5108,"raw_data":{"id":5108,"code":"todoo","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/5108","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"10.00","status":"publish","used_by":["shoug138@hotmail.com"],"meta_data":[],"description":"","product_ids":[],"usage_count":1,"usage_limit":null,"date_created":"2025-06-09T14:19:18","date_expires":"2026-01-26T00:00:00","date_modified":"2025-06-09T14:19:18","discount_type":"fixed_product","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2025-06-09T11:19:18","date_expires_gmt":"2026-01-25T21:00:00","date_modified_gmt":"2025-06-09T11:19:18","email_restrictions":[],"exclude_sale_items":false,"product_categories":[70],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":1,"usage_limit":null,"date_created":"2025-06-09T14:19:18+00:00","date_expires":"2026-01-26T00:00:00+00:00","discount_type":"fixed_product","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('4cba77f1-2eca-4798-b860-32d6c75ccef8', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'c3818f33-5426-4109-95f4-9946d09b64b8', NULL, '{"after":{"id":"c3818f33-5426-4109-95f4-9946d09b64b8","code":"free","amount":10,"woo_id":4597,"raw_data":{"id":4597,"code":"free","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/4597","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"10.00","status":"publish","used_by":["624","624","632","namareqsanaa@gmail.com"],"meta_data":[],"description":"","product_ids":[4423,4424,4425,4426,4427,4430,4431,4432,4433,4434,3823,3586,2853,2854,2855,2856,2857,2859,2860,2861,2862,2863,4112,1747,4110,2768,1759,2871,2872,2873,2874,2875,2883,2884,2885,2886,2887,3860,4108,4146,3862,3825,3773,4148,3471,3655,3142,2477,2478,2479,2480,2481,2484,2485,2486,2487,2488,4174,3150,3028,3029,3030,3031,3032,3033,3034,3035,3036,3037,3038,3039,3040,3041,3042,3043,3044,3045,3046,3047,3871,4349,4350,4351,4352,4353,1755,4106,1777,2157,2154,2655,1761,4163,4164,4165,4166,4167,1763,1737,2450,1743,4295,2703,1745,1741,2681,1735,2259,1739,3836,3450,3451,3452,3453,3454,4342,2438,3417,3418,3419,3420,3421,2441,2443,2803,2489,3751,1757,4132,3864,3753,3055,3514,3684,1765,1775,2129,4436,3615,3616,3617,3618,3619,2695,3267,1749,1751,1753],"usage_count":4,"usage_limit":null,"date_created":"2025-02-27T23:33:59","date_expires":"2025-10-10T00:00:00","date_modified":"2025-02-27T23:33:59","discount_type":"percent","free_shipping":true,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2025-02-27T20:33:59","date_expires_gmt":"2025-10-09T21:00:00","date_modified_gmt":"2025-02-27T20:33:59","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[4423,4424,4425,4426,4427,4430,4431,4432,4433,4434,3823,3586,2853,2854,2855,2856,2857,2859,2860,2861,2862,2863,4112,1747,4110,2768,1759,2871,2872,2873,2874,2875,2883,2884,2885,2886,2887,3860,4108,4146,3862,3825,3773,4148,3471,3655,3142,2477,2478,2479,2480,2481,2484,2485,2486,2487,2488,4174,3150,3028,3029,3030,3031,3032,3033,3034,3035,3036,3037,3038,3039,3040,3041,3042,3043,3044,3045,3046,3047,3871,4349,4350,4351,4352,4353,1755,4106,1777,2157,2154,2655,1761,4163,4164,4165,4166,4167,1763,1737,2450,1743,4295,2703,1745,1741,2681,1735,2259,1739,3836,3450,3451,3452,3453,3454,4342,2438,3417,3418,3419,3420,3421,2441,2443,2803,2489,3751,1757,4132,3864,3753,3055,3514,3684,1765,1775,2129,4436,3615,3616,3617,3618,3619,2695,3267,1749,1751,1753],"usage_count":4,"usage_limit":null,"date_created":"2025-02-27T23:33:59+00:00","date_expires":"2025-10-10T00:00:00+00:00","discount_type":"percent","free_shipping":true,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('6053658b-51db-4827-9248-69faf8eeba18', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'f9d1b70e-5743-41d0-9e4e-31a6e1f78f0a', NULL, '{"after":{"id":"f9d1b70e-5743-41d0-9e4e-31a6e1f78f0a","code":"zk","amount":15,"woo_id":3959,"raw_data":{"id":3959,"code":"zk","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/3959","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"15.00","status":"publish","used_by":["342","344","353","379","400","605","624"],"meta_data":[],"description":"","product_ids":[3823,3586,1747,3860,3862,3825,3773,3471,3655,3142,3150,3871,1755,2655,1761,1763,1737,2450,1743,2703,1745,1741,2681,1735,2259,1739,3836,3864,3055,3684,1765,1749,3514,3267,4106,4430,4431,4432,4433,4434,4423,4424,4425,4426,4427,4112,4110,2768,1759,2871,2872,2873,2874,2875,2883,2884,2885,2886,2887,4108,4146,4148,2477,2478,2479,2480,2481,2484,2485,2486,2487,2488,4174,3028,3029,3030,3031,3032,3033,3034,3035,3036,3037,3038,3039,3040,3041,3042,3043,3044,3045,3046,3047,4349,4350,4351,4352,4353,1777,2154,4163,4164,4165,4166,4167,4295,3450,3451,3452,3453,3454,4342,3417,3418,3419,3420,3421,2438,2441,2443,2803,2489,3751,1757,4132,3753,1775,2129,4436,2695,3615,3616,3617,3618,3619,2250,2251,2252,1751,1753],"usage_count":7,"usage_limit":null,"date_created":"2024-12-24T17:24:09","date_expires":"2025-03-01T00:00:00","date_modified":"2025-02-28T16:02:21","discount_type":"percent","free_shipping":true,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2024-12-24T14:24:09","date_expires_gmt":"2025-02-28T21:00:00","date_modified_gmt":"2025-02-28T13:02:21","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[3823,3586,1747,3860,3862,3825,3773,3471,3655,3142,3150,3871,1755,2655,1761,1763,1737,2450,1743,2703,1745,1741,2681,1735,2259,1739,3836,3864,3055,3684,1765,1749,3514,3267,4106,4430,4431,4432,4433,4434,4423,4424,4425,4426,4427,4112,4110,2768,1759,2871,2872,2873,2874,2875,2883,2884,2885,2886,2887,4108,4146,4148,2477,2478,2479,2480,2481,2484,2485,2486,2487,2488,4174,3028,3029,3030,3031,3032,3033,3034,3035,3036,3037,3038,3039,3040,3041,3042,3043,3044,3045,3046,3047,4349,4350,4351,4352,4353,1777,2154,4163,4164,4165,4166,4167,4295,3450,3451,3452,3453,3454,4342,3417,3418,3419,3420,3421,2438,2441,2443,2803,2489,3751,1757,4132,3753,1775,2129,4436,2695,3615,3616,3617,3618,3619,2250,2251,2252,1751,1753],"usage_count":7,"usage_limit":null,"date_created":"2024-12-24T17:24:09+00:00","date_expires":"2025-03-01T00:00:00+00:00","discount_type":"percent","free_shipping":true,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('933ce23d-4d90-40c1-82d8-5989a7d43c8a', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', '51dc371a-f301-43fc-acb6-90a73b66f89f', NULL, '{"after":{"id":"51dc371a-f301-43fc-acb6-90a73b66f89f","code":"opt","amount":15,"woo_id":3944,"raw_data":{"id":3944,"code":"opt","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/3944","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"15.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[3586,3860,3862,3773,3871,1755,2655,2259,3751,3864,3055,3684,1765,3615,3617,3618,3619,2695,3150],"usage_count":0,"usage_limit":null,"date_created":"2024-12-23T18:24:43","date_expires":"2024-12-25T00:00:00","date_modified":"2024-12-23T18:24:43","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2024-12-23T15:24:43","date_expires_gmt":"2024-12-24T21:00:00","date_modified_gmt":"2024-12-23T15:24:43","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[3586,3860,3862,3773,3871,1755,2655,2259,3751,3864,3055,3684,1765,3615,3617,3618,3619,2695,3150],"usage_count":0,"usage_limit":null,"date_created":"2024-12-23T18:24:43+00:00","date_expires":"2024-12-25T00:00:00+00:00","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('49e34d4b-25e9-48b9-bdd4-c9cabae8298b', '2026-04-23T07:25:16.902422+00:00', NULL, NULL, 'system', 'coupons.insert', 'coupons', 'ad681134-c046-49df-88f1-fea0ee266b47', NULL, '{"after":{"id":"ad681134-c046-49df-88f1-fea0ee266b47","code":"3h","amount":12,"woo_id":3096,"raw_data":{"id":3096,"code":"3h","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/3096","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"12.00","status":"publish","used_by":["65"],"meta_data":[{"id":29490,"key":"sa_cbl_locations_lookup_in","value":{"address":"billing"}},{"id":29540,"key":"sc_restrict_to_new_user","value":"no"},{"id":29541,"key":"auto_generate_coupon","value":"no"},{"id":29542,"key":"coupon_title_prefix","value":""},{"id":29543,"key":"coupon_title_suffix","value":""},{"id":29544,"key":"sc_coupon_validity","value":""},{"id":29545,"key":"validity_suffix","value":"days"},{"id":29546,"key":"sc_is_visible_storewide","value":"no"},{"id":29547,"key":"sc_disable_email_restriction","value":"no"},{"id":29548,"key":"is_pick_price_of_product","value":"no"},{"id":29549,"key":"wc_sc_add_product_details","value":[]},{"id":29550,"key":"wc_sc_max_discount","value":""},{"id":29551,"key":"wc_sc_expiry_time","value":"76500"},{"id":29552,"key":"wc_sc_auto_apply_coupon","value":"no"},{"id":29553,"key":"sa_cbl_billing_locations","value":[]},{"id":29554,"key":"wc_sc_payment_method_ids","value":[]},{"id":29555,"key":"wc_sc_shipping_method_ids","value":[]},{"id":29556,"key":"wc_sc_user_role_ids","value":[]},{"id":29557,"key":"wc_sc_exclude_user_role_ids","value":[]},{"id":29558,"key":"wc_sc_product_attribute_ids","value":""},{"id":29559,"key":"wc_sc_exclude_product_attribute_ids","value":""},{"id":29560,"key":"wc_sc_taxonomy_restrictions","value":[]},{"id":29561,"key":"wc_sc_excluded_customer_email","value":[]},{"id":29562,"key":"wc_coupon_message","value":""},{"id":29563,"key":"wc_email_message","value":"no"},{"id":29564,"key":"wc_sc_product_quantity_restrictions","value":{"type":"cart","values":{"cart":{"max":"","min":""},"product":[],"product_category":[]},"condition":"any"}},{"id":29565,"key":"wc_sc_cheapest_costliest_settings","value":"1_"}],"description":"This coupon is valid for use within a 3-hour period only. Make sure to redeem it promptly to enjoy the offer!","product_ids":[],"usage_count":1,"usage_limit":null,"date_created":"2024-10-02T14:19:32","date_expires":"2024-10-02T00:00:00","date_modified":"2024-10-02T18:17:28","discount_type":"percent","free_shipping":false,"individual_use":true,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2024-10-02T11:19:32","date_expires_gmt":"2024-10-01T21:00:00","date_modified_gmt":"2024-10-02T15:17:28","email_restrictions":[],"exclude_sale_items":false,"product_categories":[],"excluded_product_ids":[],"usage_limit_per_user":1,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"This coupon is valid for use within a 3-hour period only. Make sure to redeem it promptly to enjoy the offer!","product_ids":[],"usage_count":1,"usage_limit":null,"date_created":"2024-10-02T14:19:32+00:00","date_expires":"2024-10-02T00:00:00+00:00","discount_type":"percent","free_shipping":false,"individual_use":true,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":1}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('d8f43171-ccab-47eb-b666-06d5b5c375a0', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '47b6b57a-fdeb-4914-ae2f-023361aaf005', NULL, '{"before":{"id":"47b6b57a-fdeb-4914-ae2f-023361aaf005","code":"yhs","amount":29,"woo_id":6461,"raw_data":{"id":6461,"code":"yhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6461","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"29.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:06:32","date_expires":null,"date_modified":"2026-01-27T14:06:32","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T11:06:32","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T11:06:32","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:06:32+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('a55e45dc-c0ba-46da-a96a-0bb786e81ac4', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '1920aa6c-574a-4ac8-be7a-a00c4ac840aa', NULL, '{"before":{"id":"1920aa6c-574a-4ac8-be7a-a00c4ac840aa","code":"shamiya","amount":25,"woo_id":6464,"raw_data":{"id":6464,"code":"shamiya","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6464","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T15:09:12","date_expires":null,"date_modified":"2026-01-27T15:09:12","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T12:09:12","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T12:09:12","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T15:09:12+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('aa718ed1-5fd5-4b04-8104-69acf797dfcd', '2026-04-23T08:41:05.689611+00:00', '4639fed7-01dd-49f7-85dd-54e56111a352', 'arvind@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.159.122.17","path":"/api/auth/log-event","email":"arvind@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('071cbf19-1a88-4c9a-bad2-b18a0804b6f3', '2026-04-23T09:00:36.298947+00:00', '1bd711f8-2680-47f6-8e50-5bf807e846d8', 'chethan@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"172.71.152.37","path":"/api/auth/log-event","email":"chethan@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('a4bbc692-b736-457e-bd5a-295b8adc1aa1', '2026-04-23T09:14:18.545133+00:00', '1bd711f8-2680-47f6-8e50-5bf807e846d8', 'chethan@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.158.194.159","path":"/api/auth/log-event","email":"chethan@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('6316edeb-72e4-455a-8a27-8b7943236d3e', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '6035888f-9af1-4523-b1c4-5bb6157f5d9b', NULL, '{"before":{"id":"6035888f-9af1-4523-b1c4-5bb6157f5d9b","code":"jhs","amount":29,"woo_id":6463,"raw_data":{"id":6463,"code":"jhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6463","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"29.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:26:33","date_expires":null,"date_modified":"2026-01-27T14:26:33","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T11:26:33","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T11:26:33","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:26:33+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('4d493e17-afcb-47f8-a538-779f8389cd32', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '289c2b1a-5316-4d47-8bf9-5f10d07fb648', NULL, '{"before":{"id":"289c2b1a-5316-4d47-8bf9-5f10d07fb648","code":"dhs","amount":26,"woo_id":6462,"raw_data":{"id":6462,"code":"dhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6462","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:20:44","date_expires":null,"date_modified":"2026-01-27T14:20:44","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T11:20:44","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T11:20:44","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T14:20:44+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('ef1d8e97-475c-485d-8492-ec8f57756cd9', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '3aa53491-62fb-42c5-9eac-989a2c9df409', NULL, '{"before":{"id":"3aa53491-62fb-42c5-9eac-989a2c9df409","code":"kbs","amount":25,"woo_id":6460,"raw_data":{"id":6460,"code":"kbs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6460","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:59:02","date_expires":null,"date_modified":"2026-01-27T13:59:02","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:59:02","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:59:02","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:59:02+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('22c9b638-30b0-4f3e-8041-c328f11e0564', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', 'c321b277-2813-42b2-beb2-74d005a12b39', NULL, '{"before":{"id":"c321b277-2813-42b2-beb2-74d005a12b39","code":"2026","amount":22,"woo_id":6459,"raw_data":{"id":6459,"code":"2026","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6459","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"22.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:51:36","date_expires":null,"date_modified":"2026-01-27T13:51:36","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:51:36","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:51:36","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:51:36+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('35435d7a-66e9-4f4c-8557-7bf98212ff2c', '2026-04-23T08:41:34.382741+00:00', NULL, NULL, 'system', 'product.create', 'product', 'woo-7152', NULL, '{"after":{"sku":"rfvrfc","name":"Free prodcut","slug":"free-prodcut","type":"simple","price":"0","images":[],"status":"publish","woo_id":7152,"raw_data":{"id":7152,"sku":"rfvrfc","name":"Free prodcut","slug":"free-prodcut","tags":[{"id":102,"name":"handbag","slug":"handbag"}],"type":"simple","price":"0","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/products/7152","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/products"}]},"brands":[],"images":[],"status":"publish","weight":"","on_sale":false,"virtual":false,"featured":false,"downloads":[],"meta_data":[],"parent_id":0,"permalink":"https://todookw.com/product/free-prodcut/","tax_class":"","attributes":[],"backorders":"no","categories":[{"id":149,"name":"Black Friday Sales","slug":"black-friday-sale"}],"dimensions":{"width":"","height":"","length":""},"menu_order":0,"price_html":"<span class=\"woocommerce-Price-amount amount\"><bdi>0.00&nbsp;<span class=\"woocommerce-Price-currencySymbol\">KWD</span></bdi></span>","sale_price":"","tax_status":"taxable","upsell_ids":[],"variations":[],"backordered":false,"button_text":"","description":"<p>test</p>","has_options":false,"purchasable":true,"related_ids":[3055],"total_sales":0,"date_created":"2026-04-23T11:41:34","downloadable":false,"external_url":"","manage_stock":false,"rating_count":0,"stock_status":"instock","date_modified":"2026-04-23T11:41:34","post_password":"","purchase_note":"","regular_price":"0","average_rating":"0","cross_sell_ids":[],"download_limit":-1,"generated_slug":"free-prodcut","shipping_class":"","stock_quantity":null,"date_on_sale_to":null,"download_expiry":-1,"reviews_allowed":true,"date_created_gmt":"2026-04-23T08:41:34","global_unique_id":"","grouped_products":[],"low_stock_amount":null,"shipping_taxable":true,"date_modified_gmt":"2026-04-23T08:41:34","date_on_sale_from":null,"shipping_class_id":0,"shipping_required":true,"short_description":"","sold_individually":false,"backorders_allowed":false,"catalog_visibility":"visible","default_attributes":[],"permalink_template":"https://todookw.com/product/%pagename%/","date_on_sale_to_gmt":null,"date_on_sale_from_gmt":null},"store_id":"a5d4247c-eb2c-4d32-af21-283700e95b23","synced_at":"2026-04-23T08:41:34.315Z","attributes":[],"categories":[{"id":149,"name":"Black Friday Sales","slug":"black-friday-sale"}],"sale_price":"","description":"<p>test</p>","stock_status":"instock","regular_price":"0","stock_quantity":null,"short_description":""}}'::jsonb, '{"ip":"162.159.122.16","path":"/api/stores/a5d4247c-eb2c-4d32-af21-283700e95b23/products/create","method":"POST","woo_id":7152,"store_id":"a5d4247c-eb2c-4d32-af21-283700e95b23","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('ad474eeb-064c-48b6-8c64-1b366820cf0e', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', 'b317aa8d-75c0-40a8-a27a-823aa898ec99', NULL, '{"before":{"id":"b317aa8d-75c0-40a8-a27a-823aa898ec99","code":"shs","amount":25,"woo_id":6458,"raw_data":{"id":6458,"code":"shs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6458","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:47:49","date_expires":null,"date_modified":"2026-01-27T13:47:49","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:47:49","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:47:49","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:47:49+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('3a9ea51f-3f5c-4993-8093-1c942bf41f05', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '5f581b9e-38f1-48db-94a3-453a4cc284e2', NULL, '{"before":{"id":"5f581b9e-38f1-48db-94a3-453a4cc284e2","code":"fbs","amount":26,"woo_id":6457,"raw_data":{"id":6457,"code":"fbs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6457","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"26.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:46:15","date_expires":null,"date_modified":"2026-01-27T13:46:15","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:46:15","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:46:15","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,149,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:46:15+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('f68bfb12-979a-412e-8744-bfbc600d14d9', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', 'f6cda8af-65a2-4025-92a2-7bcd0b27dab0', NULL, '{"before":{"id":"f6cda8af-65a2-4025-92a2-7bcd0b27dab0","code":"mqhs","amount":30,"woo_id":6456,"raw_data":{"id":6456,"code":"mqhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6456","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"30.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:32:54","date_expires":null,"date_modified":"2026-01-27T13:32:54","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:32:54","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:32:54","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:32:54+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('6fea866a-7db0-44b1-9374-8212d955189e', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '5a9dfeea-d9e0-4068-a3ff-f331264b2b90', NULL, '{"before":{"id":"5a9dfeea-d9e0-4068-a3ff-f331264b2b90","code":"suad26","amount":25,"woo_id":6455,"raw_data":{"id":6455,"code":"suad26","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6455","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:21:42","date_expires":null,"date_modified":"2026-01-27T13:21:42","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:21:42","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:21:42","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:21:42+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('836f5e0d-e9eb-4a73-89c4-56a20b14e8c5', '2026-04-23T08:42:14.043092+00:00', '1bd711f8-2680-47f6-8e50-5bf807e846d8', 'chethan@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.158.194.159","path":"/api/auth/log-event","email":"chethan@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('6d926a6e-22b1-40ad-a021-95b4a2fbc95d', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', 'c4bbcbf2-427f-4133-86c6-01f7bb591217', NULL, '{"before":{"id":"c4bbcbf2-427f-4133-86c6-01f7bb591217","code":"omz26","amount":24,"woo_id":6454,"raw_data":{"id":6454,"code":"omz26","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6454","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"24.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:17:58","date_expires":null,"date_modified":"2026-01-27T13:17:58","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:17:58","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:17:58","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:17:58+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('f4decbc9-a905-45ed-9192-6a5ed0af7838', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '0c853d70-82ac-49d6-a76e-7d98dc5849e9', NULL, '{"before":{"id":"0c853d70-82ac-49d6-a76e-7d98dc5849e9","code":"fbm","amount":25,"woo_id":6453,"raw_data":{"id":6453,"code":"fbm","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6453","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:14:52","date_expires":null,"date_modified":"2026-01-27T13:14:52","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:14:52","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:14:52","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:14:52+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('cec5c7bc-da8d-4372-87a7-f089a8d1ba59', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '34d69fca-5d6f-448f-b0fa-953eb6f57540', NULL, '{"before":{"id":"34d69fca-5d6f-448f-b0fa-953eb6f57540","code":"ths","amount":22,"woo_id":6452,"raw_data":{"id":6452,"code":"ths","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6452","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"22.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:11:54","date_expires":null,"date_modified":"2026-01-27T13:11:54","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:11:54","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:11:54","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:11:54+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('c9b247a4-f232-4a45-ad55-df2c02c01032', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '4558a38a-d90d-46e5-99c7-e26b6e7c61f8', NULL, '{"before":{"id":"4558a38a-d90d-46e5-99c7-e26b6e7c61f8","code":"rhs","amount":23,"woo_id":6451,"raw_data":{"id":6451,"code":"rhs","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6451","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"23.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:10:21","date_expires":null,"date_modified":"2026-01-27T13:10:21","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:10:21","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:10:21","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:10:21+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('2485f073-ca8c-46d2-9b57-adb00951125a', '2026-04-23T08:42:26.856837+00:00', '4639fed7-01dd-49f7-85dd-54e56111a352', 'arvind@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.159.122.16","path":"/api/auth/log-event","email":"arvind@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('a5fce4bc-2def-4e39-ad5a-161188a35c91', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '8662ea4a-9519-42fe-9a9e-9965a7a8c111', NULL, '{"before":{"id":"8662ea4a-9519-42fe-9a9e-9965a7a8c111","code":"aas","amount":25,"woo_id":6450,"raw_data":{"id":6450,"code":"aas","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6450","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:07:29","date_expires":null,"date_modified":"2026-01-27T13:07:29","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:07:29","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:07:29","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:07:29+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('bc6ad989-3fb4-49aa-8f67-6122ca19f144', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', '7600b544-b070-411f-b00a-30df26306298', NULL, '{"before":{"id":"7600b544-b070-411f-b00a-30df26306298","code":"rbm","amount":24,"woo_id":6449,"raw_data":{"id":6449,"code":"rbm","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6449","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"24.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:04:07","date_expires":null,"date_modified":"2026-01-27T13:04:07","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T10:04:07","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T10:04:07","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T13:04:07+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('7ce431a8-de90-403c-8e0d-a18eea842b5b', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', 'a81d1a7a-1ad6-4d7e-bfa6-75028832f176', NULL, '{"before":{"id":"a81d1a7a-1ad6-4d7e-bfa6-75028832f176","code":"alansarya","amount":25,"woo_id":6448,"raw_data":{"id":6448,"code":"alansarya","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6448","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:59:23","date_expires":null,"date_modified":"2026-01-27T12:59:23","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:59:23","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:59:23","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:59:23+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('7581716d-1a96-4b73-9af0-93e4c7ee1c77', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', 'b5c22e6a-233e-438f-a6fb-eb333fbf986b', NULL, '{"before":{"id":"b5c22e6a-233e-438f-a6fb-eb333fbf986b","code":"sba","amount":24,"woo_id":6447,"raw_data":{"id":6447,"code":"sba","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6447","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"24.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:56:05","date_expires":null,"date_modified":"2026-01-27T12:56:05","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:56:05","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:56:05","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:56:05+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('fbc54881-8271-4dc7-b455-ed55fe3a7f1a', '2026-04-23T08:42:43.401152+00:00', '4639fed7-01dd-49f7-85dd-54e56111a352', 'arvind@vizsoft.in', 'user', 'auth.login', 'auth', NULL, NULL, NULL, '{"ip":"162.159.122.17","path":"/api/auth/log-event","email":"arvind@vizsoft.in","method":"POST","user_agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"}'::jsonb) ON CONFLICT DO NOTHING;
INSERT INTO "public"."activity_log" ("id", "created_at", "actor_user_id", "actor_email", "actor_type", "action", "entity_type", "entity_id", "client_id", "diff", "metadata") VALUES ('76a1b051-67aa-40c1-bd2e-d792049ed2ab', '2026-04-23T07:32:49.075048+00:00', NULL, NULL, 'system', 'coupons.delete', 'coupons', 'c00054a6-4913-4d69-a7f3-12e368fb465c', NULL, '{"before":{"id":"c00054a6-4913-4d69-a7f3-12e368fb465c","code":"kba","amount":25,"woo_id":6446,"raw_data":{"id":6446,"code":"kba","_links":{"self":[{"href":"https://todookw.com/wp-json/wc/v3/coupons/6446","targetHints":{"allow":["GET","POST","PUT","PATCH","DELETE"]}}],"collection":[{"href":"https://todookw.com/wp-json/wc/v3/coupons"}]},"amount":"25.00","status":"publish","used_by":[],"meta_data":[],"description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:53:44","date_expires":null,"date_modified":"2026-01-27T12:53:44","discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":"0.00","minimum_amount":"0.00","date_created_gmt":"2026-01-27T09:53:44","date_expires_gmt":null,"date_modified_gmt":"2026-01-27T09:53:44","email_restrictions":[],"exclude_sale_items":false,"product_categories":[62,60,79,115,92,103,116],"excluded_product_ids":[],"usage_limit_per_user":null,"limit_usage_to_x_items":null,"excluded_product_categories":[]},"store_id":"aaf98e99-e187-43da-978b-fb728b2f58f2","synced_at":"2026-04-23T07:25:16.861+00:00","created_at":"2026-04-23T07:25:16.902422+00:00","description":"","product_ids":[],"usage_count":0,"usage_limit":null,"date_created":"2026-01-27T12:53:44+00:00","date_expires":null,"discount_type":"percent","free_shipping":false,"individual_use":false,"maximum_amount":0,"minimum_amount":0,"excluded_product_ids":[],"usage_limit_per_user":null}}'::jsonb, NULL) ON CONFLICT DO NOTHING;
