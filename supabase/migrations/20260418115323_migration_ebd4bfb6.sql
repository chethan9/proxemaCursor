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