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