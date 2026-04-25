ALTER TABLE sync_runs
  ADD COLUMN IF NOT EXISTS cursor_page integer,
  ADD COLUMN IF NOT EXISTS total_pages integer,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sync_runs_heartbeat ON sync_runs(last_heartbeat_at) WHERE status = 'running';