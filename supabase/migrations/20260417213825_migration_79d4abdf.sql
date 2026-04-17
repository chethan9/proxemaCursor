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