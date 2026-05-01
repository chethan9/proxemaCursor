-- Materialized dashboard snapshots for fast site home; heavy aggregation runs on refresh / cold miss only.

CREATE TABLE public.dashboard_summary (
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  tz text NOT NULL,
  currency_key text NOT NULL DEFAULT '',
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_summary_pkey PRIMARY KEY (store_id, tz, currency_key)
);

CREATE INDEX dashboard_summary_store_updated_idx ON public.dashboard_summary (store_id, updated_at DESC);

ALTER TABLE public.dashboard_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY dashboard_summary_select ON public.dashboard_summary
  FOR SELECT TO authenticated
  USING (public.user_can_access_store(store_id));

COMMENT ON TABLE public.dashboard_summary IS 'Precomputed JSON payload from compute_site_home_stats; read fast path in get_site_home_stats.';

-- Internal: full aggregation (former get_site_home_stats body, 3-arg currency-aware).
CREATE OR REPLACE FUNCTION public.compute_site_home_stats(
  p_store_id uuid,
  p_tz text DEFAULT 'UTC'::text,
  p_currency text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_today_start timestamptz;
  v_week_start timestamptz;
  v_month_start timestamptz;
  v_result jsonb;
  v_stats jsonb;
  v_daily jsonb;
  v_status jsonb;
  v_recent jsonb;
  v_top jsonb;
  v_currencies jsonb;
  v_effective_currency text;
  v_store_currency text;
  v_revenue_statuses text[] := ARRAY['completed','processing'];
BEGIN
  v_today_start := date_trunc('day', (now() AT TIME ZONE p_tz)) AT TIME ZONE p_tz;
  v_week_start := v_today_start - interval '6 days';
  v_month_start := v_today_start - interval '29 days';

  SELECT COALESCE(currency, 'USD') INTO v_store_currency FROM stores WHERE id = p_store_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', currency, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_currencies
  FROM (
    SELECT COALESCE(NULLIF(currency, ''), v_store_currency) AS currency, COUNT(*) AS cnt
    FROM orders
    WHERE store_id = p_store_id
      AND date_created >= v_month_start
      AND status = ANY(v_revenue_statuses)
    GROUP BY 1
  ) c;

  v_effective_currency := COALESCE(
    p_currency,
    (SELECT c->>'code' FROM jsonb_array_elements(v_currencies) c LIMIT 1),
    v_store_currency
  );

  SELECT jsonb_build_object(
    'orders_today', COUNT(*) FILTER (WHERE date_created >= v_today_start AND status = ANY(v_revenue_statuses)),
    'orders_in_progress', COUNT(*) FILTER (WHERE status IN ('pending','processing','on-hold')),
    'sales_today', COALESCE(SUM(CASE WHEN date_created >= v_today_start AND status = ANY(v_revenue_statuses) AND COALESCE(NULLIF(currency,''), v_store_currency) = v_effective_currency THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'sales_week', COALESCE(SUM(CASE WHEN date_created >= v_week_start AND status = ANY(v_revenue_statuses) AND COALESCE(NULLIF(currency,''), v_store_currency) = v_effective_currency THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'sales_month', COALESCE(SUM(CASE WHEN date_created >= v_month_start AND status = ANY(v_revenue_statuses) AND COALESCE(NULLIF(currency,''), v_store_currency) = v_effective_currency THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'orders_month_count', COUNT(*) FILTER (WHERE date_created >= v_month_start AND status = ANY(v_revenue_statuses) AND COALESCE(NULLIF(currency,''), v_store_currency) = v_effective_currency),
    'sales_prev_month', COALESCE(SUM(CASE WHEN date_created >= v_month_start - interval '30 days' AND date_created < v_month_start AND status = ANY(v_revenue_statuses) AND COALESCE(NULLIF(currency,''), v_store_currency) = v_effective_currency THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'orders_total', COUNT(*) FILTER (WHERE status = ANY(v_revenue_statuses))
  ) INTO v_stats
  FROM orders
  WHERE store_id = p_store_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', day, 'orders', order_count, 'revenue', revenue) ORDER BY day), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT
      to_char(d::date, 'YYYY-MM-DD') AS day,
      COUNT(o.id) AS order_count,
      COALESCE(SUM(COALESCE(o.total::numeric, 0) - COALESCE(o.total_tax::numeric, 0) - COALESCE(o.shipping_total::numeric, 0)), 0) AS revenue
    FROM generate_series(v_month_start, v_today_start, interval '1 day') d
    LEFT JOIN orders o ON o.store_id = p_store_id
      AND o.date_created >= d AND o.date_created < d + interval '1 day'
      AND o.status = ANY(v_revenue_statuses)
      AND COALESCE(NULLIF(o.currency,''), v_store_currency) = v_effective_currency
    GROUP BY d
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('status', status, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_status
  FROM (
    SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS cnt
    FROM orders
    WHERE store_id = p_store_id AND date_created >= v_month_start
    GROUP BY status
  ) s;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.date_created DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT id, woo_id, order_number, status, total, currency, date_created, line_items, billing
    FROM orders
    WHERE store_id = p_store_id
    ORDER BY date_created DESC NULLS LAST
    LIMIT 10
  ) r;

  WITH items AS (
    SELECT
      (li->>'product_id')::bigint AS product_id,
      li->>'name' AS name,
      COALESCE((li->>'quantity')::int, 0) AS qty,
      COALESCE((li->>'total')::numeric, 0) AS revenue
    FROM orders o, jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) li
    WHERE o.store_id = p_store_id
      AND o.date_created >= v_month_start
      AND o.status = ANY(v_revenue_statuses)
      AND COALESCE(NULLIF(o.currency,''), v_store_currency) = v_effective_currency
      AND li->>'product_id' IS NOT NULL
  ),
  agg AS (
    SELECT product_id, MAX(name) AS name, SUM(qty) AS units, SUM(revenue) AS revenue
    FROM items
    GROUP BY product_id
    ORDER BY revenue DESC NULLS LAST
    LIMIT 10
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', a.product_id,
    'name', a.name,
    'units', a.units,
    'revenue', a.revenue,
    'image', (SELECT (p.images->0->>'src') FROM products p WHERE p.store_id = p_store_id AND p.woo_id = a.product_id LIMIT 1),
    'local_id', (SELECT p.id::text FROM products p WHERE p.store_id = p_store_id AND p.woo_id = a.product_id LIMIT 1)
  )), '[]'::jsonb)
  INTO v_top
  FROM agg a;

  v_result := jsonb_build_object(
    'stats', v_stats,
    'daily', v_daily,
    'status_breakdown', v_status,
    'recent_orders', v_recent,
    'top_products', v_top,
    'currencies', v_currencies,
    'currency', v_effective_currency
  );

  RETURN v_result;
END;
$function$;

-- Fast path: return cached row when present; otherwise compute once and populate cache.
CREATE OR REPLACE FUNCTION public.get_site_home_stats(
  p_store_id uuid,
  p_tz text DEFAULT 'UTC'::text,
  p_currency text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  ck text;
  cached_payload jsonb;
  cached_updated timestamptz;
  computed jsonb;
BEGIN
  ck := COALESCE(NULLIF(trim(p_currency), ''), '');

  SELECT ds.payload, ds.updated_at INTO cached_payload, cached_updated
  FROM public.dashboard_summary ds
  WHERE ds.store_id = p_store_id AND ds.tz = p_tz AND ds.currency_key = ck;

  IF FOUND THEN
    RETURN cached_payload || jsonb_build_object('snapshot_updated_at', to_jsonb(cached_updated));
  END IF;

  computed := public.compute_site_home_stats(p_store_id, p_tz, NULLIF(NULLIF(trim(p_currency), ''), ''));

  INSERT INTO public.dashboard_summary (store_id, tz, currency_key, payload, updated_at)
  VALUES (p_store_id, p_tz, ck, computed, now())
  ON CONFLICT (store_id, tz, currency_key)
  DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at;

  RETURN computed || jsonb_build_object('snapshot_updated_at', to_jsonb(now()));
END;
$function$;

-- Background / admin: recompute snapshots for default + distinct order currencies (SECURITY DEFINER writes through RLS).
CREATE OR REPLACE FUNCTION public.refresh_dashboard_summaries_for_store(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tz text;
  v_store_currency text;
  r RECORD;
BEGIN
  SELECT COALESCE(NULLIF(trim(timezone), ''), 'UTC'), COALESCE(currency, 'USD')
  INTO v_tz, v_store_currency
  FROM stores WHERE id = p_store_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.dashboard_summary (store_id, tz, currency_key, payload, updated_at)
  VALUES (
    p_store_id,
    v_tz,
    '',
    public.compute_site_home_stats(p_store_id, v_tz, NULL),
    now()
  )
  ON CONFLICT (store_id, tz, currency_key)
  DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();

  FOR r IN
    SELECT DISTINCT COALESCE(NULLIF(o.currency, ''), v_store_currency) AS cur
    FROM orders o
    WHERE o.store_id = p_store_id
      AND o.date_created >= (now() - interval '120 days')
  LOOP
    IF r.cur IS NULL OR trim(r.cur::text) = '' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.dashboard_summary (store_id, tz, currency_key, payload, updated_at)
    VALUES (
      p_store_id,
      v_tz,
      r.cur::text,
      public.compute_site_home_stats(p_store_id, v_tz, r.cur::text),
      now()
    )
    ON CONFLICT (store_id, tz, currency_key)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.compute_site_home_stats(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_site_home_stats(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_site_home_stats(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.refresh_dashboard_summaries_for_store(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_summaries_for_store(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
