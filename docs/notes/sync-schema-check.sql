-- Verifies the live DB has all columns/tables the new 3-stage sync code expects.
-- Every row should return 'EXISTS'. Anything 'MISSING' = needs to be added.

SELECT 'sync_runs.cursor_page' AS item,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_runs' AND column_name='cursor_page') THEN 'EXISTS' ELSE 'MISSING' END AS status
UNION ALL SELECT 'sync_runs.total_pages',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_runs' AND column_name='total_pages') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'sync_runs.last_heartbeat_at',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_runs' AND column_name='last_heartbeat_at') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'sync_runs.is_initial',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_runs' AND column_name='is_initial') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'sync_runs.attempt',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_runs' AND column_name='attempt') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'sync_runs.next_retry_at',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_runs' AND column_name='next_retry_at') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'sync_runs.request_url',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_runs' AND column_name='request_url') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'sync_runs.response_status',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sync_runs' AND column_name='response_status') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'table:sync_benchmarks',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='sync_benchmarks') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'table:store_aspect_sync_state',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='store_aspect_sync_state') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'stores.initial_sync_completed_at',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stores' AND column_name='initial_sync_completed_at') THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL SELECT 'stores.last_full_sync_at',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stores' AND column_name='last_full_sync_at') THEN 'EXISTS' ELSE 'MISSING' END;