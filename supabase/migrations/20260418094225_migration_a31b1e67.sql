CREATE TABLE IF NOT EXISTS user_view_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  view_key TEXT NOT NULL,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, view_key)
);
ALTER TABLE user_view_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_select" ON user_view_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON user_view_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update" ON user_view_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_delete" ON user_view_preferences FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_uvp_user_view ON user_view_preferences(user_id, view_key);