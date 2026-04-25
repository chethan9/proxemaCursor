CREATE TABLE IF NOT EXISTS public.store_aspect_sync_state (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  aspect text NOT NULL,
  last_synced_at timestamptz,
  last_completed_at timestamptz NOT NULL DEFAULT now(),
  records_seen integer NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, aspect)
);

ALTER TABLE public.store_aspect_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_all ON public.store_aspect_sync_state;
CREATE POLICY service_role_all ON public.store_aspect_sync_state
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_aspect_state_store ON public.store_aspect_sync_state(store_id);

NOTIFY pgrst, 'reload schema';