-- Create cron_logs table for tracking scheduled job executions
CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL DEFAULT 'sync',
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'started',
  message TEXT,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_cron_logs_store_id ON cron_logs(store_id);
CREATE INDEX IF NOT EXISTS idx_cron_logs_started_at ON cron_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_logs_job_type ON cron_logs(job_type);

-- Enable RLS
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select_cron_logs" ON cron_logs FOR SELECT USING (true);
CREATE POLICY "public_insert_cron_logs" ON cron_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_cron_logs" ON cron_logs FOR UPDATE USING (true);