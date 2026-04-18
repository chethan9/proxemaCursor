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