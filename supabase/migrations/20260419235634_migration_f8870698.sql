ALTER TABLE sync_runs DROP CONSTRAINT IF EXISTS sync_runs_status_check;
ALTER TABLE sync_runs ADD CONSTRAINT sync_runs_status_check CHECK (status IN ('running', 'completed', 'failed', 'cancelled'));

UPDATE sync_runs
SET status = 'cancelled', completed_at = NOW(), error_message = 'Cleanup: stuck run'
WHERE status = 'running'
  AND store_id IN (SELECT id FROM stores WHERE url ILIKE '%todookw%');

DELETE FROM stores WHERE url ILIKE '%todookw%';