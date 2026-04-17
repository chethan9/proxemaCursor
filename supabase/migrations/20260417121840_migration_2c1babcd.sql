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