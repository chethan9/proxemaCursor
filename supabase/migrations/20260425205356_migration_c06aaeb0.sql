ALTER TABLE sync_runs
  ADD COLUMN IF NOT EXISTS cursor_page INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_pages INTEGER;

CREATE INDEX IF NOT EXISTS idx_sync_runs_running_heartbeat
  ON sync_runs (last_heartbeat_at)
  WHERE status = 'running';