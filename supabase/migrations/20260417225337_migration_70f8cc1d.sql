CREATE TABLE entity_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  woo_id bigint NULL,
  entity_name text NULL,
  change_type text NOT NULL,
  changed_fields jsonb NULL DEFAULT '[]'::jsonb,
  snapshot_before jsonb NULL,
  snapshot_after jsonb NULL,
  source text NOT NULL DEFAULT 'webhook',
  created_at timestamptz NULL DEFAULT now()
);

CREATE INDEX idx_entity_changes_store ON entity_changes(store_id);
CREATE INDEX idx_entity_changes_entity ON entity_changes(entity_type, entity_id);
CREATE INDEX idx_entity_changes_woo ON entity_changes(store_id, entity_type, woo_id);
CREATE INDEX idx_entity_changes_created ON entity_changes(created_at DESC);

ALTER TABLE entity_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entity_changes_select" ON entity_changes FOR SELECT USING (true);
CREATE POLICY "entity_changes_insert" ON entity_changes FOR INSERT WITH CHECK (true);

COMMENT ON TABLE entity_changes IS 'Tracks all field-level changes to synced WooCommerce entities';
COMMENT ON COLUMN entity_changes.change_type IS 'created, updated, deleted, status_change';
COMMENT ON COLUMN entity_changes.changed_fields IS 'Array of {field, old, new} objects';
COMMENT ON COLUMN entity_changes.source IS 'webhook, sync, manual';