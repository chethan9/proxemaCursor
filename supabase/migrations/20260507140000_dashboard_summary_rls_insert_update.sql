-- get_site_home_stats INSERT ... ON CONFLICT DO UPDATE on cache miss runs as authenticated.
-- dashboard_summary had SELECT-only RLS, causing: new row violates row-level security policy.

DROP POLICY IF EXISTS dashboard_summary_insert ON public.dashboard_summary;
DROP POLICY IF EXISTS dashboard_summary_update ON public.dashboard_summary;

CREATE POLICY dashboard_summary_insert ON public.dashboard_summary
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_store(store_id));

CREATE POLICY dashboard_summary_update ON public.dashboard_summary
  FOR UPDATE TO authenticated
  USING (public.user_can_access_store(store_id))
  WITH CHECK (public.user_can_access_store(store_id));

NOTIFY pgrst, 'reload schema';
