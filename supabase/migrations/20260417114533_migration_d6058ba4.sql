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