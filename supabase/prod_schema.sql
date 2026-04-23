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

-- 20260423120000_menu_configs_schema_sync.sql
-- Sync menu_configs to current dev schema (adds id/scope/site_id columns)
-- Idempotent: safe to run against any state of the table.

-- 1. Add missing columns
ALTER TABLE public.menu_configs ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.menu_configs ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global';
ALTER TABLE public.menu_configs ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- 2. Backfill id for any existing rows
UPDATE public.menu_configs SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.menu_configs ALTER COLUMN id SET NOT NULL;

-- 3. Swap primary key from role → id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.menu_configs'::regclass
      AND contype = 'p'
      AND conname = 'menu_configs_pkey'
  ) THEN
    -- Check if current PK is on role alone
    IF (
      SELECT array_agg(a.attname ORDER BY a.attname)
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.menu_configs'::regclass
        AND c.contype = 'p'
    ) = ARRAY['role']::name[] THEN
      ALTER TABLE public.menu_configs DROP CONSTRAINT menu_configs_pkey;
      ALTER TABLE public.menu_configs ADD CONSTRAINT menu_configs_pkey PRIMARY KEY (id);
    END IF;
  ELSE
    ALTER TABLE public.menu_configs ADD CONSTRAINT menu_configs_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- 4. Unique indexes replacing the old role-only uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS menu_configs_role_global_key
  ON public.menu_configs (role)
  WHERE scope = 'global' AND site_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS menu_configs_role_site_key
  ON public.menu_configs (role, site_id)
  WHERE scope = 'site' AND site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_configs_scope_site
  ON public.menu_configs (scope, site_id);
