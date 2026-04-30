-- Field-level audit trail linked to activity_log rows (90-day retention batches delete both).
-- RLS mirrors activity_log visibility: super admin, actor self, or same client_id.

CREATE TABLE IF NOT EXISTS public.activity_diff_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_log_id uuid NOT NULL REFERENCES public.activity_log(id) ON DELETE CASCADE,
  field_path text NOT NULL,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_diff_items_log ON public.activity_diff_items (activity_log_id);
CREATE INDEX IF NOT EXISTS idx_activity_diff_items_created ON public.activity_diff_items (created_at DESC);

-- Query filters often combine action + time range
CREATE INDEX IF NOT EXISTS idx_activity_log_action_created ON public.activity_log (action, created_at DESC);

COMMENT ON TABLE public.activity_diff_items IS 'Per-field before/after snapshots for audit detail UI; deleted with parent activity_log row.';

ALTER TABLE public.activity_diff_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_diff_items_admin_read ON public.activity_diff_items;
CREATE POLICY activity_diff_items_admin_read ON public.activity_diff_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activity_log al
      WHERE al.id = activity_log_id AND public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS activity_diff_items_self_read ON public.activity_diff_items;
CREATE POLICY activity_diff_items_self_read ON public.activity_diff_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activity_log al
      WHERE al.id = activity_log_id AND al.actor_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS activity_diff_items_client_read ON public.activity_diff_items;
CREATE POLICY activity_diff_items_client_read ON public.activity_diff_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activity_log al
      WHERE al.id = activity_log_id
        AND al.client_id IS NOT NULL
        AND al.client_id = public.current_user_client_id()
    )
  );

-- Immutable: no INSERT/UPDATE/DELETE for authenticated role (service role bypasses RLS)
