ALTER TABLE entity_changes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';
ALTER TABLE entity_changes ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE entity_changes ADD COLUMN IF NOT EXISTS retry_payload JSONB;
CREATE INDEX IF NOT EXISTS idx_entity_changes_status ON entity_changes(store_id, status) WHERE status = 'failed';