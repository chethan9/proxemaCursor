-- Custom date ranges (e.g. 90 days) hit get_site_home_stats with both period bounds set.
-- digest(text, 'sha256') does not match pgcrypto digest(bytea, text), causing:
--   function digest(text, unknown) does not exist
-- Period cache key (pk) was computed but never used; custom ranges always skip_cache.

CREATE OR REPLACE FUNCTION public.get_site_home_stats(
  p_store_id uuid,
  p_tz text DEFAULT 'UTC'::text,
  p_currency text DEFAULT NULL::text,
  p_period_start timestamptz DEFAULT NULL::timestamptz,
  p_period_end timestamptz DEFAULT NULL::timestamptz,
  p_combine_all boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $get$
DECLARE
  ck text;
  cached_payload jsonb;
  cached_updated timestamptz;
  computed jsonb;
  skip_cache boolean := false;
BEGIN
  ck := CASE WHEN COALESCE(p_combine_all, false) THEN '' ELSE COALESCE(NULLIF(trim(p_currency), ''), '') END;

  IF p_period_start IS NOT NULL AND p_period_end IS NOT NULL THEN
    skip_cache := true;
  END IF;

  IF NOT skip_cache THEN
    SELECT ds.payload, ds.updated_at INTO cached_payload, cached_updated
    FROM public.dashboard_summary ds
    WHERE ds.store_id = p_store_id
      AND ds.tz = p_tz
      AND ds.currency_key = ck
      AND ds.period_key = ''
      AND ds.combine_all = COALESCE(p_combine_all, false);

    IF FOUND THEN
      RETURN cached_payload || jsonb_build_object('snapshot_updated_at', to_jsonb(cached_updated));
    END IF;
  END IF;

  computed := public.compute_site_home_stats(
    p_store_id,
    p_tz,
    CASE WHEN p_combine_all THEN NULL ELSE NULLIF(trim(p_currency), '') END,
    p_period_start,
    p_period_end,
    COALESCE(p_combine_all, false)
  );

  IF NOT skip_cache THEN
    INSERT INTO public.dashboard_summary (store_id, tz, currency_key, period_key, combine_all, payload, updated_at)
    VALUES (p_store_id, p_tz, ck, '', COALESCE(p_combine_all, false), computed, now())
    ON CONFLICT (store_id, tz, currency_key, period_key, combine_all)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at;
  END IF;

  RETURN computed || jsonb_build_object('snapshot_updated_at', to_jsonb(now()));
END;
$get$;

NOTIFY pgrst, 'reload schema';
