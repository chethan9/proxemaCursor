-- ============================================================================
-- Live reconciliation migration
-- Brings any environment to parity with Dev as of 2026-04-25.
-- Idempotent: safe to re-run on Dev, Test, or Live.
--
-- Covers drift identified in task-196:
--   1. plans.is_default_trial column
--   2. payment_gateway_settings table + RLS + policy
--   3. touch_payment_gateway_settings() trigger function + trigger
--   4. unmark_other_default_trials() trigger function + trigger on plans
--   5. get_site_home_stats(uuid, text, text) 3-arg version + drop stale 2-arg
--   6. stores.last_full_sync_at column (already applied to Live, kept for parity)
-- ============================================================================

-- 1. plans.is_default_trial
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS is_default_trial boolean NOT NULL DEFAULT false;

-- 2. payment_gateway_settings table
CREATE TABLE IF NOT EXISTS public.payment_gateway_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'test',
  publishable_key text,
  secret_key text,
  webhook_secret text,
  extra_config jsonb DEFAULT '{}'::jsonb,
  country_overrides text[] DEFAULT ARRAY[]::text[],
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_gateway_settings_gateway_name_key
  ON public.payment_gateway_settings (gateway_name);

ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_read_gateway_settings ON public.payment_gateway_settings;
CREATE POLICY auth_read_gateway_settings ON public.payment_gateway_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 3. touch_payment_gateway_settings + trigger
CREATE OR REPLACE FUNCTION public.touch_payment_gateway_settings()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_pgs ON public.payment_gateway_settings;
CREATE TRIGGER trg_touch_pgs
  BEFORE UPDATE ON public.payment_gateway_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_payment_gateway_settings();

-- 4. unmark_other_default_trials + trigger on plans
CREATE OR REPLACE FUNCTION public.unmark_other_default_trials()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_default_trial = true THEN
    UPDATE public.plans
       SET is_default_trial = false
     WHERE id <> NEW.id
       AND is_default_trial = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unmark_other_default_trials ON public.plans;
CREATE TRIGGER trg_unmark_other_default_trials
  AFTER INSERT OR UPDATE OF is_default_trial ON public.plans
  FOR EACH ROW WHEN (NEW.is_default_trial = true)
  EXECUTE FUNCTION public.unmark_other_default_trials();

-- 5. get_site_home_stats — drop stale 2-arg overload, install 3-arg version
DROP FUNCTION IF EXISTS public.get_site_home_stats(uuid, text);

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

-- 6. stores.last_full_sync_at (already applied to Live, kept for parity on other envs)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS last_full_sync_at timestamptz;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';