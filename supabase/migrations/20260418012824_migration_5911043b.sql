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