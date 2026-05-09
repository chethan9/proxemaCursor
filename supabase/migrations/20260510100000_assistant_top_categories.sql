-- Top-selling categories by line-item revenue (aligned with dashboard period + revenue statuses).

CREATE OR REPLACE FUNCTION public.get_top_selling_categories(
  p_store_id uuid,
  p_tz text DEFAULT 'UTC'::text,
  p_currency text DEFAULT NULL::text,
  p_period_start timestamptz DEFAULT NULL::timestamptz,
  p_period_end timestamptz DEFAULT NULL::timestamptz,
  p_combine_all boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'public'
AS $function$
DECLARE
  v_today_start timestamptz;
  v_month_start timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_custom boolean;
  v_store_currency text;
  v_effective_currency text;
  v_revenue_statuses text[] := ARRAY['completed', 'processing'];
  v_currencies jsonb;
  v_top_cat jsonb;
BEGIN
  v_today_start := date_trunc('day', (now() AT TIME ZONE p_tz)) AT TIME ZONE p_tz;
  v_month_start := v_today_start - interval '29 days';
  v_custom := p_period_start IS NOT NULL AND p_period_end IS NOT NULL;

  IF v_custom THEN
    v_period_start := LEAST(p_period_start, p_period_end);
    v_period_end := GREATEST(p_period_start, p_period_end);
  ELSE
    v_period_start := v_month_start;
    v_period_end := now();
  END IF;

  SELECT COALESCE(currency, 'USD') INTO v_store_currency FROM public.stores WHERE id = p_store_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', currency, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_currencies
  FROM (
    SELECT COALESCE(NULLIF(currency, ''), v_store_currency) AS currency, COUNT(*) AS cnt
    FROM public.orders
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

  IF p_combine_all THEN
    WITH items2 AS (
      SELECT
        COALESCE(NULLIF(trim(pr.categories->0->>'name'), ''), 'Uncategorized') AS cat_name,
        CASE
          WHEN pr.categories->0 ? 'id' THEN NULLIF(regexp_replace(pr.categories->0->>'id', '[^0-9-]', '', 'g'), '')::bigint
          ELSE NULL
        END AS cat_woo_id,
        COALESCE((li->>'quantity')::numeric, 0) AS qty,
        COALESCE((li->>'total')::numeric, 0) AS line_rev,
        COALESCE(NULLIF(o.currency, ''), v_store_currency) AS cur
      FROM public.orders o
      CROSS JOIN jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) AS li
      LEFT JOIN public.products pr ON pr.store_id = p_store_id AND pr.woo_id = (li->>'product_id')::bigint
      WHERE o.store_id = p_store_id
        AND o.date_created >= v_period_start
        AND o.date_created <= v_period_end
        AND o.status = ANY(v_revenue_statuses)
        AND li->>'product_id' IS NOT NULL
    ),
    agg AS (
      SELECT
        cat_name,
        MAX(cat_woo_id) AS cat_woo_id,
        SUM(qty) AS units,
        SUM(public.fx_convert_currency(line_rev, cur, v_store_currency)) AS revenue
      FROM items2
      GROUP BY cat_name
      ORDER BY SUM(public.fx_convert_currency(line_rev, cur, v_store_currency)) DESC NULLS LAST
      LIMIT 10
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'category_name', a.cat_name,
      'category_woo_id', a.cat_woo_id,
      'units', a.units,
      'revenue', a.revenue
    ) ORDER BY a.revenue DESC NULLS LAST), '[]'::jsonb)
    INTO v_top_cat
    FROM agg a;
  ELSE
    WITH items AS (
      SELECT
        COALESCE(NULLIF(trim(pr.categories->0->>'name'), ''), 'Uncategorized') AS cat_name,
        CASE
          WHEN pr.categories->0 ? 'id' THEN NULLIF(regexp_replace(pr.categories->0->>'id', '[^0-9-]', '', 'g'), '')::bigint
          ELSE NULL
        END AS cat_woo_id,
        COALESCE((li->>'quantity')::numeric, 0) AS qty,
        COALESCE((li->>'total')::numeric, 0) AS line_rev
      FROM public.orders o
      CROSS JOIN jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) AS li
      LEFT JOIN public.products pr ON pr.store_id = p_store_id AND pr.woo_id = (li->>'product_id')::bigint
      WHERE o.store_id = p_store_id
        AND o.date_created >= v_period_start
        AND o.date_created <= v_period_end
        AND o.status = ANY(v_revenue_statuses)
        AND COALESCE(NULLIF(o.currency, ''), v_store_currency) = v_effective_currency
        AND li->>'product_id' IS NOT NULL
    ),
    agg AS (
      SELECT
        cat_name,
        MAX(cat_woo_id) AS cat_woo_id,
        SUM(qty) AS units,
        SUM(line_rev) AS revenue
      FROM items
      GROUP BY cat_name
      ORDER BY SUM(line_rev) DESC NULLS LAST
      LIMIT 10
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'category_name', a.cat_name,
      'category_woo_id', a.cat_woo_id,
      'units', a.units,
      'revenue', a.revenue
    ) ORDER BY a.revenue DESC NULLS LAST), '[]'::jsonb)
    INTO v_top_cat
    FROM agg a;
  END IF;

  RETURN COALESCE(v_top_cat, '[]'::jsonb);
END;
$function$;

COMMENT ON FUNCTION public.get_top_selling_categories(uuid, text, text, timestamptz, timestamptz, boolean)
  IS 'Rollup line-item revenue by product primary category for assistant / analytics; mirrors dashboard period and revenue statuses.';

GRANT EXECUTE ON FUNCTION public.get_top_selling_categories(uuid, text, text, timestamptz, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_selling_categories(uuid, text, text, timestamptz, timestamptz, boolean) TO service_role;
