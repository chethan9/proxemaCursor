-- Part B: dashboard date range, combine-all-currencies (FX), extended dashboard_summary cache keys.
-- Preserves legacy fast path: period_key='' AND combine_all=false matches prior behavior.

-- ---------------------------------------------------------------------------
-- FX snapshot (Frankfurter ECB daily rates; base EUR)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.global_fx_rates (
  id int PRIMARY KEY CHECK (id = 1),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.global_fx_rates (id, payload)
VALUES (1, '{"base":"EUR","rates":{}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.global_fx_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS global_fx_rates_select ON public.global_fx_rates;
CREATE POLICY global_fx_rates_select ON public.global_fx_rates
  FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE public.global_fx_rates IS 'Latest ECB FX snapshot (Frankfurter shape: base EUR + rates map). Used by combine-all dashboard mode.';

-- Convert amount from p_from currency to p_to using payload.rates (units of currency per 1 EUR).
CREATE OR REPLACE FUNCTION public.fx_convert_currency(p_amount numeric, p_from text, p_to text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fx$
DECLARE
  r jsonb;
  rates jsonb;
  from_u text;
  to_u text;
  eur_amt numeric;
  rate_from numeric;
  rate_to numeric;
BEGIN
  IF p_amount IS NULL OR p_amount = 0 THEN RETURN 0; END IF;
  from_u := upper(trim(COALESCE(p_from, '')));
  to_u := upper(trim(COALESCE(p_to, '')));
  IF from_u = '' OR to_u = '' THEN RETURN p_amount; END IF;
  IF from_u = to_u THEN RETURN p_amount; END IF;

  SELECT payload INTO r FROM public.global_fx_rates WHERE id = 1;
  IF r IS NULL OR r->'rates' IS NULL THEN RETURN p_amount; END IF;
  rates := r->'rates';

  IF from_u = 'EUR' THEN
    eur_amt := p_amount;
  ELSE
    IF NOT (rates ? from_u) THEN RETURN p_amount; END IF;
    rate_from := NULLIF((rates->>from_u)::numeric, 0);
    IF rate_from IS NULL THEN RETURN p_amount; END IF;
    eur_amt := p_amount / rate_from;
  END IF;

  IF to_u = 'EUR' THEN
    RETURN eur_amt;
  END IF;

  IF NOT (rates ? to_u) THEN RETURN p_amount; END IF;
  rate_to := (rates->>to_u)::numeric;
  RETURN eur_amt * COALESCE(rate_to, 1);
END;
$fx$;

-- ---------------------------------------------------------------------------
-- dashboard_summary: cache dimensions period_key + combine_all
-- ---------------------------------------------------------------------------
ALTER TABLE public.dashboard_summary
  ADD COLUMN IF NOT EXISTS period_key text NOT NULL DEFAULT '';

ALTER TABLE public.dashboard_summary
  ADD COLUMN IF NOT EXISTS combine_all boolean NOT NULL DEFAULT false;

ALTER TABLE public.dashboard_summary DROP CONSTRAINT IF EXISTS dashboard_summary_pkey;

ALTER TABLE public.dashboard_summary
  ADD CONSTRAINT dashboard_summary_pkey PRIMARY KEY (store_id, tz, currency_key, period_key, combine_all);

CREATE INDEX IF NOT EXISTS dashboard_summary_lookup_idx
  ON public.dashboard_summary (store_id, tz, currency_key, period_key, combine_all);

-- ---------------------------------------------------------------------------
-- Core aggregation (replaces former 3-arg compute_site_home_stats body)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.compute_site_home_stats(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_site_home_stats(uuid, text, text);

CREATE OR REPLACE FUNCTION public.compute_site_home_stats(
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
AS $compute$
DECLARE
  v_today_start timestamptz;
  v_week_start timestamptz;
  v_month_start timestamptz;
  v_month_prev_start timestamptz;
  v_custom boolean;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
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
  v_fx_fallback boolean := false;
BEGIN
  v_today_start := date_trunc('day', (now() AT TIME ZONE p_tz)) AT TIME ZONE p_tz;
  v_week_start := v_today_start - interval '6 days';
  v_month_start := v_today_start - interval '29 days';
  v_month_prev_start := v_month_start - interval '30 days';

  v_custom := p_period_start IS NOT NULL AND p_period_end IS NOT NULL;

  IF v_custom THEN
    v_period_start := LEAST(p_period_start, p_period_end);
    v_period_end := GREATEST(p_period_start, p_period_end);
    v_prev_end := v_period_start;
    v_prev_start := v_period_start - (v_period_end - v_period_start);
  ELSE
    v_period_start := v_month_start;
    v_period_end := now();
    v_prev_start := v_month_start - interval '30 days';
    v_prev_end := v_month_start;
  END IF;

  SELECT COALESCE(currency, 'USD') INTO v_store_currency FROM stores WHERE id = p_store_id;

  SELECT NOT (payload ? 'rates' AND jsonb_typeof(payload->'rates') = 'object' AND payload->'rates' <> '{}'::jsonb)
  INTO v_fx_fallback
  FROM public.global_fx_rates WHERE id = 1;

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

  IF p_combine_all THEN
    v_effective_currency := v_store_currency;
  ELSE
    v_effective_currency := COALESCE(
      NULLIF(trim(p_currency), ''),
      (SELECT c->>'code' FROM jsonb_array_elements(v_currencies) c LIMIT 1),
      v_store_currency
    );
  END IF;

  SELECT jsonb_build_object(
    'orders_today', COUNT(*) FILTER (WHERE
      (CASE WHEN v_custom THEN date_created >= v_period_start AND date_created <= v_period_end
       ELSE date_created >= v_today_start END)
      AND status = ANY(v_revenue_statuses)),
    'orders_in_progress', COUNT(*) FILTER (WHERE status IN ('pending','processing','on-hold')),
    'sales_today', COALESCE(SUM(
      CASE
        WHEN NOT (CASE WHEN v_custom THEN date_created >= v_period_start AND date_created <= v_period_end
                  ELSE date_created >= v_today_start END) THEN 0
        WHEN status <> ALL(v_revenue_statuses) THEN 0
        ELSE
          CASE WHEN p_combine_all THEN
            public.fx_convert_currency(
              COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0),
              COALESCE(NULLIF(currency, ''), v_store_currency),
              v_store_currency
            )
          ELSE
            CASE WHEN COALESCE(NULLIF(currency, ''), v_store_currency) = v_effective_currency
              THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0)
              ELSE 0 END
          END
      END
    ), 0),
    'sales_week', COALESCE(SUM(
      CASE
        WHEN NOT (CASE WHEN v_custom THEN date_created >= v_period_start AND date_created <= v_period_end
                  ELSE date_created >= v_week_start END) THEN 0
        WHEN status <> ALL(v_revenue_statuses) THEN 0
        ELSE
          CASE WHEN p_combine_all THEN
            public.fx_convert_currency(
              COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0),
              COALESCE(NULLIF(currency, ''), v_store_currency),
              v_store_currency
            )
          ELSE
            CASE WHEN COALESCE(NULLIF(currency, ''), v_store_currency) = v_effective_currency
              THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0)
              ELSE 0 END
          END
      END
    ), 0),
    'sales_month', COALESCE(SUM(
      CASE
        WHEN NOT (date_created >= v_period_start AND date_created <= v_period_end) THEN 0
        WHEN status <> ALL(v_revenue_statuses) THEN 0
        ELSE
          CASE WHEN p_combine_all THEN
            public.fx_convert_currency(
              COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0),
              COALESCE(NULLIF(currency, ''), v_store_currency),
              v_store_currency
            )
          ELSE
            CASE WHEN COALESCE(NULLIF(currency, ''), v_store_currency) = v_effective_currency
              THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0)
              ELSE 0 END
          END
      END
    ), 0),
    'orders_month_count', COUNT(*) FILTER (WHERE
      date_created >= v_period_start AND date_created <= v_period_end
      AND status = ANY(v_revenue_statuses)
      AND (p_combine_all OR COALESCE(NULLIF(currency, ''), v_store_currency) = v_effective_currency)),
    'sales_prev_month', COALESCE(SUM(
      CASE
        WHEN NOT (date_created >= v_prev_start AND date_created < v_prev_end) THEN 0
        WHEN status <> ALL(v_revenue_statuses) THEN 0
        ELSE
          CASE WHEN p_combine_all THEN
            public.fx_convert_currency(
              COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0),
              COALESCE(NULLIF(currency, ''), v_store_currency),
              v_store_currency
            )
          ELSE
            CASE WHEN COALESCE(NULLIF(currency, ''), v_store_currency) = v_effective_currency
              THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0)
              ELSE 0 END
          END
      END
    ), 0),
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
      COALESCE(SUM(
        CASE WHEN p_combine_all THEN
          public.fx_convert_currency(
            COALESCE(o.total::numeric, 0) - COALESCE(o.total_tax::numeric, 0) - COALESCE(o.shipping_total::numeric, 0),
            COALESCE(NULLIF(o.currency, ''), v_store_currency),
            v_store_currency
          )
        ELSE
          CASE WHEN COALESCE(NULLIF(o.currency, ''), v_store_currency) = v_effective_currency
            THEN COALESCE(o.total::numeric, 0) - COALESCE(o.total_tax::numeric, 0) - COALESCE(o.shipping_total::numeric, 0)
            ELSE 0 END
        END
      ), 0) AS revenue
    FROM generate_series(
      (v_period_start AT TIME ZONE p_tz)::date,
      (v_period_end AT TIME ZONE p_tz)::date,
      interval '1 day'
    ) d
    LEFT JOIN orders o ON o.store_id = p_store_id
      AND (o.date_created AT TIME ZONE p_tz)::date = d::date
      AND o.status = ANY(v_revenue_statuses)
    GROUP BY d
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('status', status, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_status
  FROM (
    SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS cnt
    FROM orders
    WHERE store_id = p_store_id
      AND date_created >= v_period_start
      AND date_created <= v_period_end
    GROUP BY status
  ) st;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.date_created DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT id, woo_id, order_number, status, total, currency, date_created, line_items, billing
    FROM orders
    WHERE store_id = p_store_id
    ORDER BY date_created DESC NULLS LAST
    LIMIT 10
  ) r;

  IF p_combine_all THEN
    WITH items2 AS (
      SELECT
        (li->>'product_id')::bigint AS product_id,
        li->>'name' AS name,
        COALESCE((li->>'quantity')::int, 0) AS qty,
        COALESCE((li->>'total')::numeric, 0) AS line_rev,
        COALESCE(NULLIF(o.currency, ''), v_store_currency) AS cur
      FROM orders o, jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) li
      WHERE o.store_id = p_store_id
        AND o.date_created >= v_period_start
        AND o.date_created <= v_period_end
        AND o.status = ANY(v_revenue_statuses)
        AND li->>'product_id' IS NOT NULL
    ),
    conv AS (
      SELECT
        product_id,
        MAX(name) AS name,
        SUM(qty) AS units,
        SUM(public.fx_convert_currency(line_rev, cur, v_store_currency)) AS revenue
      FROM items2
      GROUP BY product_id
      ORDER BY SUM(public.fx_convert_currency(line_rev, cur, v_store_currency)) DESC NULLS LAST
      LIMIT 10
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'product_id', c.product_id,
      'name', c.name,
      'units', c.units,
      'revenue', c.revenue,
      'image', (SELECT (p.images->0->>'src') FROM products p WHERE p.store_id = p_store_id AND p.woo_id = c.product_id LIMIT 1),
      'local_id', (SELECT p.id::text FROM products p WHERE p.store_id = p_store_id AND p.woo_id = c.product_id LIMIT 1)
    ) ORDER BY c.revenue DESC NULLS LAST), '[]'::jsonb)
    INTO v_top
    FROM conv c;
  ELSE
    WITH items AS (
      SELECT
        (li->>'product_id')::bigint AS product_id,
        li->>'name' AS name,
        COALESCE((li->>'quantity')::int, 0) AS qty,
        COALESCE((li->>'total')::numeric, 0) AS rev
      FROM orders o, jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) li
      WHERE o.store_id = p_store_id
        AND o.date_created >= v_period_start
        AND o.date_created <= v_period_end
        AND o.status = ANY(v_revenue_statuses)
        AND COALESCE(NULLIF(o.currency, ''), v_store_currency) = v_effective_currency
        AND li->>'product_id' IS NOT NULL
    ),
    agg AS (
      SELECT product_id, MAX(name) AS name, SUM(qty) AS units, SUM(rev) AS revenue
      FROM items
      GROUP BY product_id
      ORDER BY SUM(rev) DESC NULLS LAST
      LIMIT 10
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'product_id', a.product_id,
      'name', a.name,
      'units', a.units,
      'revenue', a.revenue,
      'image', (SELECT (p.images->0->>'src') FROM products p WHERE p.store_id = p_store_id AND p.woo_id = a.product_id LIMIT 1),
      'local_id', (SELECT p.id::text FROM products p WHERE p.store_id = p_store_id AND p.woo_id = a.product_id LIMIT 1)
    ) ORDER BY a.revenue DESC NULLS LAST), '[]'::jsonb)
    INTO v_top
    FROM agg a;
  END IF;

  v_result := jsonb_build_object(
    'stats', v_stats,
    'daily', v_daily,
    'status_breakdown', v_status,
    'recent_orders', v_recent,
    'top_products', v_top,
    'currencies', v_currencies,
    'currency', v_effective_currency,
    'meta', jsonb_build_object(
      'period_custom', v_custom,
      'combine_all', p_combine_all,
      'fx_fallback', COALESCE(v_fx_fallback, true),
      'period_start', to_jsonb(v_period_start),
      'period_end', to_jsonb(v_period_end)
    )
  );

  RETURN v_result;
END;
$compute$;

-- ---------------------------------------------------------------------------
-- Public read API with cache
-- ---------------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION public.refresh_dashboard_summaries_for_store(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $refresh$
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

  INSERT INTO public.dashboard_summary (store_id, tz, currency_key, period_key, combine_all, payload, updated_at)
  VALUES (
    p_store_id,
    v_tz,
    '',
    '',
    false,
    public.compute_site_home_stats(p_store_id, v_tz, NULL, NULL, NULL, false),
    now()
  )
  ON CONFLICT (store_id, tz, currency_key, period_key, combine_all)
  DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();

  INSERT INTO public.dashboard_summary (store_id, tz, currency_key, period_key, combine_all, payload, updated_at)
  VALUES (
    p_store_id,
    v_tz,
    '',
    '',
    true,
    public.compute_site_home_stats(p_store_id, v_tz, NULL, NULL, NULL, true),
    now()
  )
  ON CONFLICT (store_id, tz, currency_key, period_key, combine_all)
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

    INSERT INTO public.dashboard_summary (store_id, tz, currency_key, period_key, combine_all, payload, updated_at)
    VALUES (
      p_store_id,
      v_tz,
      r.cur::text,
      '',
      false,
      public.compute_site_home_stats(p_store_id, v_tz, r.cur::text, NULL, NULL, false),
      now()
    )
    ON CONFLICT (store_id, tz, currency_key, period_key, combine_all)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = now();
  END LOOP;
END;
$refresh$;

REVOKE ALL ON FUNCTION public.compute_site_home_stats(uuid, text, text, timestamptz, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_site_home_stats(uuid, text, text, timestamptz, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_site_home_stats(uuid, text, text, timestamptz, timestamptz, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.get_site_home_stats(uuid, text, text, timestamptz, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_site_home_stats(uuid, text, text, timestamptz, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_site_home_stats(uuid, text, text, timestamptz, timestamptz, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.fx_convert_currency(numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fx_convert_currency(numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fx_convert_currency(numeric, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
