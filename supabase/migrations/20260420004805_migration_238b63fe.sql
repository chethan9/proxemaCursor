ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS initial_sync_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS celebration_shown_at TIMESTAMPTZ;