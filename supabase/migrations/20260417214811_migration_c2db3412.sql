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