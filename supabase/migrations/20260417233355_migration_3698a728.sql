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