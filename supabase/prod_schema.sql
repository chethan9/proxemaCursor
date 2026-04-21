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
