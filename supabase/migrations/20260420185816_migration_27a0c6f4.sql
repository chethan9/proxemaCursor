ALTER TABLE stores ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL;

UPDATE stores s SET onboarding_completed_at = COALESCE(
  s.initial_sync_completed_at,
  (SELECT MIN(started_at) FROM sync_runs WHERE store_id = s.id AND is_initial = true)
)
WHERE s.onboarding_completed_at IS NULL
  AND (s.initial_sync_completed_at IS NOT NULL
       OR EXISTS (SELECT 1 FROM sync_runs WHERE store_id = s.id AND is_initial = true));

CREATE INDEX IF NOT EXISTS idx_stores_onboarding_incomplete ON stores(client_id) WHERE onboarding_completed_at IS NULL;