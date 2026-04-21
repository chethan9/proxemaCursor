ALTER TABLE sync_runs
  ADD COLUMN IF NOT EXISTS attempt INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS request_url TEXT,
  ADD COLUMN IF NOT EXISTS request_method TEXT,
  ADD COLUMN IF NOT EXISTS request_params JSONB,
  ADD COLUMN IF NOT EXISTS response_status INT,
  ADD COLUMN IF NOT EXISTS response_body TEXT,
  ADD COLUMN IF NOT EXISTS response_headers JSONB;

ALTER TABLE sync_runs DROP CONSTRAINT IF EXISTS sync_runs_status_check;
ALTER TABLE sync_runs ADD CONSTRAINT sync_runs_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'retrying'));

CREATE INDEX IF NOT EXISTS idx_sync_runs_retry ON sync_runs (status, next_retry_at)
  WHERE status = 'retrying';