-- Site home dashboard stats RPC
-- Returns aggregated stats, daily trend (30d), status breakdown (30d),
-- 10 most recent orders, and top 10 products by revenue (30d) for a given store.
CREATE OR REPLACE FUNCTION public.get_site_home_stats(p_store_id uuid, p_tz text DEFAULT 'UTC'::text)
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
  v_revenue_statuses text[] := ARRAY['completed','processing'];
BEGIN
  v_today_start := date_trunc('day', (now() AT TIME ZONE p_tz)) AT TIME ZONE p_tz;
  v_week_start := v_today_start - interval '6 days';
  v_month_start := v_today_start - interval '29 days';

  SELECT jsonb_build_object(
    'orders_today', COUNT(*) FILTER (WHERE date_created >= v_today_start AND status = ANY(v_revenue_statuses)),
    'orders_in_progress', COUNT(*) FILTER (WHERE status IN ('pending','processing','on-hold')),
    'sales_today', COALESCE(SUM(CASE WHEN date_created >= v_today_start AND status = ANY(v_revenue_statuses) THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'sales_week', COALESCE(SUM(CASE WHEN date_created >= v_week_start AND status = ANY(v_revenue_statuses) THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'sales_month', COALESCE(SUM(CASE WHEN date_created >= v_month_start AND status = ANY(v_revenue_statuses) THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
    'orders_month_count', COUNT(*) FILTER (WHERE date_created >= v_month_start AND status = ANY(v_revenue_statuses)),
    'sales_prev_month', COALESCE(SUM(CASE WHEN date_created >= v_month_start - interval '30 days' AND date_created < v_month_start AND status = ANY(v_revenue_statuses) THEN COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0) ELSE 0 END), 0),
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
    'top_products', v_top
  );

  RETURN v_result;
END;
$function$;