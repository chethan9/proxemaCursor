CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  actor_type text NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'admin', 'system', 'api')),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  diff jsonb,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON public.activity_log (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_client ON public.activity_log (client_id, created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_log_admin_read ON public.activity_log;
CREATE POLICY activity_log_admin_read ON public.activity_log
  FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS activity_log_self_read ON public.activity_log;
CREATE POLICY activity_log_self_read ON public.activity_log
  FOR SELECT TO authenticated USING (actor_user_id = auth.uid());

DROP POLICY IF EXISTS activity_log_client_scoped_read ON public.activity_log;
CREATE POLICY activity_log_client_scoped_read ON public.activity_log
  FOR SELECT TO authenticated USING (
    client_id IS NOT NULL AND client_id = public.current_user_client_id()
  );