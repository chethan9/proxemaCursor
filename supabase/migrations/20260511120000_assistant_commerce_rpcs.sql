-- Assistant commerce RPCs: composable aggregates for tools / proxima-widget payloads.
-- Revenue aligns with dashboard: net of tax + shipping on orders with status completed|processing.

CREATE OR REPLACE FUNCTION public.assistant_period_kpis(
  p_store_id uuid,
  p_tz text DEFAULT 'UTC'::text,
  p_currency text DEFAULT NULL::text,
  p_period_start timestamptz DEFAULT NULL::timestamptz,
  p_period_end timestamptz DEFAULT NULL::timestamptz,
  p_combine_all boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
DECLARE
  v_today_start timestamptz;
  v_month_start timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_custom boolean;
  v_store_currency text;
  v_effective_currency text;
  v_revenue_statuses text[] := ARRAY['completed', 'processing'];
  v_currencies jsonb;
  v_cur_rev numeric;
  v_prev_rev numeric;
  v_cur_ord bigint;
  v_prev_ord bigint;
BEGIN
  v_today_start := date_trunc('day', (now() AT TIME ZONE p_tz)) AT TIME ZONE p_tz;
  v_month_start := v_today_start - interval '29 days';
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
    SELECT
      COALESCE(SUM(
        public.fx_convert_currency(
          COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0),
          COALESCE(NULLIF(currency, ''), v_store_currency),
          v_store_currency
        )
      ), 0),
      COUNT(*)::bigint
    INTO v_cur_rev, v_cur_ord
    FROM public.orders
    WHERE store_id = p_store_id
      AND date_created >= v_period_start AND date_created <= v_period_end
      AND status = ANY(v_revenue_statuses);

    SELECT
      COALESCE(SUM(
        public.fx_convert_currency(
          COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0),
          COALESCE(NULLIF(currency, ''), v_store_currency),
          v_store_currency
        )
      ), 0),
      COUNT(*)::bigint
    INTO v_prev_rev, v_prev_ord
    FROM public.orders
    WHERE store_id = p_store_id
      AND date_created >= v_prev_start AND date_created < v_prev_end
      AND status = ANY(v_revenue_statuses);
  ELSE
    SELECT
      COALESCE(SUM(
        COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0)
      ), 0),
      COUNT(*)::bigint
    INTO v_cur_rev, v_cur_ord
    FROM public.orders
    WHERE store_id = p_store_id
      AND date_created >= v_period_start AND date_created <= v_period_end
      AND status = ANY(v_revenue_statuses)
      AND COALESCE(NULLIF(currency, ''), v_store_currency) = v_effective_currency;

    SELECT
      COALESCE(SUM(
        COALESCE(total::numeric, 0) - COALESCE(total_tax::numeric, 0) - COALESCE(shipping_total::numeric, 0)
      ), 0),
      COUNT(*)::bigint
    INTO v_prev_rev, v_prev_ord
    FROM public.orders
    WHERE store_id = p_store_id
      AND date_created >= v_prev_start AND date_created < v_prev_end
      AND status = ANY(v_revenue_statuses)
      AND COALESCE(NULLIF(currency, ''), v_store_currency) = v_effective_currency;
  END IF;

  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'period_start', v_period_start,
      'period_end', v_period_end,
      'previous_period_start', v_prev_start,
      'previous_period_end', v_prev_end,
      'currency', v_effective_currency,
      'combine_all', p_combine_all,
      'custom_range', v_custom
    ),
    'current', jsonb_build_object(
      'revenue', v_cur_rev,
      'orders', v_cur_ord,
      'aov', CASE WHEN v_cur_ord > 0 THEN v_cur_rev / v_cur_ord ELSE 0 END
    ),
    'previous', jsonb_build_object(
      'revenue', v_prev_rev,
      'orders', v_prev_ord,
      'aov', CASE WHEN v_prev_ord > 0 THEN v_prev_rev / v_prev_ord ELSE 0 END
    ),
    'delta_pct', jsonb_build_object(
      'revenue', CASE WHEN v_prev_rev > 0 THEN ((v_cur_rev - v_prev_rev) / v_prev_rev) * 100 ELSE NULL END,
      'orders', CASE WHEN v_prev_ord > 0 THEN ((v_cur_ord::numeric - v_prev_ord::numeric) / v_prev_ord::numeric) * 100 ELSE NULL END
    )
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.assistant_product_rankings(
  p_store_id uuid,
  p_tz text DEFAULT 'UTC'::text,
  p_currency text DEFAULT NULL::text,
  p_period_start timestamptz DEFAULT NULL::timestamptz,
  p_period_end timestamptz DEFAULT NULL::timestamptz,
  p_combine_all boolean DEFAULT false,
  p_sort text DEFAULT 'revenue'::text,
  p_limit int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
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
  v_sort_units boolean := lower(trim(p_sort)) = 'units';
  v_lim int := LEAST(GREATEST(COALESCE(p_limit, 12), 1), 50);
  v_result jsonb;
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
        (li->>'product_id')::bigint AS product_id,
        li->>'name' AS line_name,
        COALESCE((li->>'quantity')::int, 0) AS qty,
        COALESCE((li->>'total')::numeric, 0) AS line_rev,
        COALESCE(NULLIF(o.currency, ''), v_store_currency) AS cur
      FROM public.orders o,
        jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) li
      WHERE o.store_id = p_store_id
        AND o.date_created >= v_period_start
        AND o.date_created <= v_period_end
        AND o.status = ANY(v_revenue_statuses)
        AND li->>'product_id' IS NOT NULL
    ),
    conv AS (
      SELECT
        product_id,
        MAX(line_name) AS name,
        SUM(qty)::bigint AS units,
        SUM(public.fx_convert_currency(line_rev, cur, v_store_currency)) AS revenue
      FROM items2
      GROUP BY product_id
    ),
    ranked AS (
      SELECT *
      FROM conv
      ORDER BY
        CASE WHEN v_sort_units THEN units ELSE revenue END DESC NULLS LAST
      LIMIT v_lim
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'product_id', r.product_id,
      'name', COALESCE(pr.name, r.name),
      'sku', pr.sku,
      'units', r.units,
      'revenue', r.revenue,
      'image', (pr.images->0->>'src'),
      'images', pr.images,
      'image_mirror_urls', pr.image_mirror_urls,
      'local_id', pr.id::text
    ) ORDER BY CASE WHEN v_sort_units THEN r.units ELSE r.revenue END DESC NULLS LAST), '[]'::jsonb)
    INTO v_result
    FROM ranked r
    LEFT JOIN public.products pr ON pr.store_id = p_store_id AND pr.woo_id = r.product_id;
  ELSE
    WITH items AS (
      SELECT
        (li->>'product_id')::bigint AS product_id,
        li->>'name' AS line_name,
        COALESCE((li->>'quantity')::int, 0) AS qty,
        COALESCE((li->>'total')::numeric, 0) AS rev
      FROM public.orders o,
        jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) li
      WHERE o.store_id = p_store_id
        AND o.date_created >= v_period_start
        AND o.date_created <= v_period_end
        AND o.status = ANY(v_revenue_statuses)
        AND COALESCE(NULLIF(o.currency, ''), v_store_currency) = v_effective_currency
        AND li->>'product_id' IS NOT NULL
    ),
    agg AS (
      SELECT product_id, MAX(line_name) AS name, SUM(qty)::bigint AS units, SUM(rev) AS revenue
      FROM items
      GROUP BY product_id
    ),
    ranked AS (
      SELECT *
      FROM agg
      ORDER BY CASE WHEN v_sort_units THEN units ELSE revenue END DESC NULLS LAST
      LIMIT v_lim
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'product_id', r.product_id,
      'name', COALESCE(pr.name, r.name),
      'sku', pr.sku,
      'units', r.units,
      'revenue', r.revenue,
      'image', (pr.images->0->>'src'),
      'images', pr.images,
      'image_mirror_urls', pr.image_mirror_urls,
      'local_id', pr.id::text
    ) ORDER BY CASE WHEN v_sort_units THEN r.units ELSE r.revenue END DESC NULLS LAST), '[]'::jsonb)
    INTO v_result
    FROM ranked r
    LEFT JOIN public.products pr ON pr.store_id = p_store_id AND pr.woo_id = r.product_id;
  END IF;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.assistant_inventory_snapshot(
  p_store_id uuid,
  p_low_stock_threshold int DEFAULT 5,
  p_limit int DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
DECLARE
  v_lim int := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100);
  v_thr int := GREATEST(COALESCE(p_low_stock_threshold, 5), 0);
  v_out jsonb;
  v_low bigint;
  v_out_stock bigint;
  v_inst bigint;
BEGIN
  SELECT COUNT(*) INTO v_low
  FROM public.products
  WHERE store_id = p_store_id
    AND manage_stock IS TRUE
    AND stock_quantity IS NOT NULL
    AND stock_quantity <= v_thr
    AND stock_quantity > 0;

  SELECT COUNT(*) INTO v_out_stock
  FROM public.products
  WHERE store_id = p_store_id
    AND (stock_status = 'outofstock' OR (manage_stock IS TRUE AND COALESCE(stock_quantity, 0) <= 0));

  SELECT COUNT(*) INTO v_inst
  FROM public.products
  WHERE store_id = p_store_id AND manage_stock IS TRUE;

  SELECT COALESCE(jsonb_agg(row_to_json(x.*)::jsonb ORDER BY x.stock_quantity ASC NULLS LAST), '[]'::jsonb)
  INTO v_out
  FROM (
    SELECT
      id AS local_id,
      name,
      sku,
      stock_status,
      stock_quantity,
      manage_stock,
      images,
      image_mirror_urls
    FROM public.products
    WHERE store_id = p_store_id
      AND manage_stock IS TRUE
      AND stock_quantity IS NOT NULL
      AND stock_quantity <= v_thr
      AND stock_quantity > 0
    ORDER BY stock_quantity ASC NULLS LAST
    LIMIT v_lim
  ) x;

  RETURN jsonb_build_object(
    'summary', jsonb_build_object(
      'managed_products', v_inst,
      'low_stock_count', v_low,
      'out_of_stock_count', v_out_stock,
      'low_stock_threshold', v_thr
    ),
    'low_stock', COALESCE(v_out, '[]'::jsonb)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.assistant_orders_filtered(
  p_store_id uuid,
  p_tz text DEFAULT 'UTC'::text,
  p_status_csv text DEFAULT NULL::text,
  p_period_start timestamptz DEFAULT NULL::timestamptz,
  p_period_end timestamptz DEFAULT NULL::timestamptz,
  p_limit int DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
DECLARE
  v_lim int := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_today_start timestamptz;
  v_month_start timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_custom boolean;
  v_statuses text[];
  v_rows jsonb;
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

  IF p_status_csv IS NOT NULL AND trim(p_status_csv) <> '' THEN
    SELECT array_agg(lower(trim(x))) INTO v_statuses
    FROM unnest(string_to_array(p_status_csv, ',')) AS x
    WHERE trim(x) <> '';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(o.*)::jsonb ORDER BY o.date_created DESC NULLS LAST), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      id,
      woo_id,
      order_number,
      status,
      total,
      currency,
      date_created,
      customer_id
    FROM public.orders
    WHERE store_id = p_store_id
      AND date_created >= v_period_start
      AND date_created <= v_period_end
      AND (v_statuses IS NULL OR lower(COALESCE(status, '')) = ANY(v_statuses))
    ORDER BY date_created DESC NULLS LAST
    LIMIT v_lim
  ) o;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.assistant_customer_coupon_stats(
  p_store_id uuid,
  p_tz text DEFAULT 'UTC'::text,
  p_currency text DEFAULT NULL::text,
  p_period_start timestamptz DEFAULT NULL::timestamptz,
  p_period_end timestamptz DEFAULT NULL::timestamptz,
  p_combine_all boolean DEFAULT false,
  p_customer_limit int DEFAULT 12,
  p_coupon_limit int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
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
  v_clim int := LEAST(GREATEST(COALESCE(p_customer_limit, 12), 1), 50);
  v_colim int := LEAST(GREATEST(COALESCE(p_coupon_limit, 12), 1), 50);
  v_customers jsonb;
  v_coupons jsonb;
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
    WITH ord_rev AS (
      SELECT
        o.id,
        o.customer_id,
        public.fx_convert_currency(
          COALESCE(o.total::numeric, 0) - COALESCE(o.total_tax::numeric, 0) - COALESCE(o.shipping_total::numeric, 0),
          COALESCE(NULLIF(o.currency, ''), v_store_currency),
          v_store_currency
        ) AS net_rev
      FROM public.orders o
      WHERE o.store_id = p_store_id
        AND o.date_created >= v_period_start AND o.date_created <= v_period_end
        AND o.status = ANY(v_revenue_statuses)
        AND o.customer_id IS NOT NULL
    ),
    cust AS (
      SELECT
        c.id AS customer_uuid,
        COALESCE(NULLIF(trim(c.email), ''), c.username, 'customer') AS label,
        SUM(r.net_rev) AS revenue,
        COUNT(*)::bigint AS orders_n
      FROM ord_rev r
      JOIN public.customers c ON c.store_id = p_store_id AND c.woo_id = r.customer_id
      GROUP BY c.id, c.email, c.username
      ORDER BY SUM(r.net_rev) DESC NULLS LAST
      LIMIT v_clim
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'customer_id', customer_uuid,
      'label', label,
      'revenue', revenue,
      'orders', orders_n
    ) ORDER BY revenue DESC NULLS LAST), '[]'::jsonb)
    INTO v_customers
    FROM cust;
  ELSE
    WITH ord_rev AS (
      SELECT
        o.id,
        o.customer_id,
        COALESCE(o.total::numeric, 0) - COALESCE(o.total_tax::numeric, 0) - COALESCE(o.shipping_total::numeric, 0) AS net_rev
      FROM public.orders o
      WHERE o.store_id = p_store_id
        AND o.date_created >= v_period_start AND o.date_created <= v_period_end
        AND o.status = ANY(v_revenue_statuses)
        AND COALESCE(NULLIF(o.currency, ''), v_store_currency) = v_effective_currency
        AND o.customer_id IS NOT NULL
    ),
    cust AS (
      SELECT
        c.id AS customer_uuid,
        COALESCE(NULLIF(trim(c.email), ''), c.username, 'customer') AS label,
        SUM(r.net_rev) AS revenue,
        COUNT(*)::bigint AS orders_n
      FROM ord_rev r
      JOIN public.customers c ON c.store_id = p_store_id AND c.woo_id = r.customer_id
      GROUP BY c.id, c.email, c.username
      ORDER BY SUM(r.net_rev) DESC NULLS LAST
      LIMIT v_clim
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'customer_id', customer_uuid,
      'label', label,
      'revenue', revenue,
      'orders', orders_n
    ) ORDER BY revenue DESC NULLS LAST), '[]'::jsonb)
    INTO v_customers
    FROM cust;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'code', code,
    'orders_with_code', uses_n,
    'discount_total', disc_sum
  ) ORDER BY uses_n DESC NULLS LAST), '[]'::jsonb)
  INTO v_coupons
  FROM (
    SELECT
      upper(trim(elem->>'code')) AS code,
      COUNT(DISTINCT o.id)::bigint AS uses_n,
      COALESCE(SUM(COALESCE((elem->>'discount')::numeric, 0)), 0) AS disc_sum
    FROM public.orders o,
      jsonb_array_elements(COALESCE(o.coupon_lines, '[]'::jsonb)) elem
    WHERE o.store_id = p_store_id
      AND o.date_created >= v_period_start AND o.date_created <= v_period_end
      AND o.status = ANY(v_revenue_statuses)
      AND elem->>'code' IS NOT NULL AND trim(elem->>'code') <> ''
    GROUP BY upper(trim(elem->>'code'))
    ORDER BY COUNT(DISTINCT o.id) DESC NULLS LAST
    LIMIT v_colim
  ) q;

  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'period_start', v_period_start,
      'period_end', v_period_end,
      'currency', v_effective_currency,
      'combine_all', p_combine_all
    ),
    'top_customers', COALESCE(v_customers, '[]'::jsonb),
    'coupon_codes', COALESCE(v_coupons, '[]'::jsonb)
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.assistant_basket_pairs(
  p_store_id uuid,
  p_period_start timestamptz DEFAULT NULL::timestamptz,
  p_period_end timestamptz DEFAULT NULL::timestamptz,
  p_pair_limit int DEFAULT 15,
  p_max_orders int DEFAULT 400
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
DECLARE
  v_tz text := 'UTC';
  v_today_start timestamptz;
  v_month_start timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_custom boolean;
  v_revenue_statuses text[] := ARRAY['completed', 'processing'];
  v_plim int := LEAST(GREATEST(COALESCE(p_pair_limit, 15), 1), 80);
  v_omax int := LEAST(GREATEST(COALESCE(p_max_orders, 400), 50), 5000);
  v_result jsonb;
BEGIN
  v_today_start := date_trunc('day', (now() AT TIME ZONE v_tz)) AT TIME ZONE v_tz;
  v_month_start := v_today_start - interval '29 days';
  v_custom := p_period_start IS NOT NULL AND p_period_end IS NOT NULL;

  IF v_custom THEN
    v_period_start := LEAST(p_period_start, p_period_end);
    v_period_end := GREATEST(p_period_start, p_period_end);
  ELSE
    v_period_start := v_month_start;
    v_period_end := now();
  END IF;

  WITH recent AS (
    SELECT id
    FROM public.orders
    WHERE store_id = p_store_id
      AND date_created >= v_period_start AND date_created <= v_period_end
      AND status = ANY(v_revenue_statuses)
    ORDER BY date_created DESC NULLS LAST
    LIMIT v_omax
  ),
  pairs AS (
    SELECT
      LEAST((li1->>'product_id')::bigint, (li2->>'product_id')::bigint) AS a,
      GREATEST((li1->>'product_id')::bigint, (li2->>'product_id')::bigint) AS b
    FROM recent r
    JOIN public.orders o ON o.id = r.id,
      jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) li1,
      jsonb_array_elements(COALESCE(o.line_items, '[]'::jsonb)) li2
    WHERE li1->>'product_id' IS NOT NULL AND li2->>'product_id' IS NOT NULL
      AND (li1->>'product_id')::bigint <> (li2->>'product_id')::bigint
      AND (li1->>'product_id')::bigint < (li2->>'product_id')::bigint
  ),
  agg AS (
    SELECT a AS product_id_a, b AS product_id_b, COUNT(*)::bigint AS pair_orders
    FROM pairs
    GROUP BY a, b
    ORDER BY COUNT(*) DESC NULLS LAST
    LIMIT v_plim
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id_a', agg.product_id_a,
    'product_id_b', agg.product_id_b,
    'name_a', pa.name,
    'name_b', pb.name,
    'pair_orders', agg.pair_orders
  ) ORDER BY agg.pair_orders DESC NULLS LAST), '[]'::jsonb)
  INTO v_result
  FROM agg
  LEFT JOIN public.products pa ON pa.store_id = p_store_id AND pa.woo_id = agg.product_id_a
  LEFT JOIN public.products pb ON pb.store_id = p_store_id AND pb.woo_id = agg.product_id_b;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.assistant_catalog_quality(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $fn$
DECLARE
  v_total bigint;
  v_no_img bigint;
  v_draft bigint;
  v_no_sku bigint;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.products WHERE store_id = p_store_id;

  SELECT COUNT(*) INTO v_no_img
  FROM public.products
  WHERE store_id = p_store_id
    AND (
      images IS NULL
      OR images = '[]'::jsonb
      OR (jsonb_typeof(images) = 'array' AND jsonb_array_length(images) = 0)
    );

  SELECT COUNT(*) INTO v_draft
  FROM public.products
  WHERE store_id = p_store_id AND lower(COALESCE(status, '')) = 'draft';

  SELECT COUNT(*) INTO v_no_sku
  FROM public.products
  WHERE store_id = p_store_id AND (sku IS NULL OR trim(sku) = '');

  RETURN jsonb_build_object(
    'total_products', v_total,
    'missing_image', v_no_img,
    'draft_status', v_draft,
    'missing_sku', v_no_sku
  );
END;
$fn$;

COMMENT ON FUNCTION public.assistant_period_kpis(uuid, text, text, timestamptz, timestamptz, boolean)
  IS 'Period vs previous-period KPI comparison for assistant widgets.';
COMMENT ON FUNCTION public.assistant_product_rankings(uuid, text, text, timestamptz, timestamptz, boolean, text, int)
  IS 'Top products by revenue or units with product row enrichment.';
COMMENT ON FUNCTION public.assistant_inventory_snapshot(uuid, int, int)
  IS 'Low-stock summary and rows for assistant alerts.';
COMMENT ON FUNCTION public.assistant_orders_filtered(uuid, text, text, timestamptz, timestamptz, int)
  IS 'Orders in dashboard-aligned window with optional CSV status filter.';
COMMENT ON FUNCTION public.assistant_customer_coupon_stats(uuid, text, text, timestamptz, timestamptz, boolean, int, int)
  IS 'Top spending customers and coupon code frequency for the period.';
COMMENT ON FUNCTION public.assistant_basket_pairs(uuid, timestamptz, timestamptz, int, int)
  IS 'Frequent product pairs (bounded scan depth) — diagnostics.';
COMMENT ON FUNCTION public.assistant_catalog_quality(uuid)
  IS 'Catalog completeness counters for assistant QA hints.';

GRANT EXECUTE ON FUNCTION public.assistant_period_kpis(uuid, text, text, timestamptz, timestamptz, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_period_kpis(uuid, text, text, timestamptz, timestamptz, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_product_rankings(uuid, text, text, timestamptz, timestamptz, boolean, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_product_rankings(uuid, text, text, timestamptz, timestamptz, boolean, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_inventory_snapshot(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_inventory_snapshot(uuid, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_orders_filtered(uuid, text, text, timestamptz, timestamptz, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_orders_filtered(uuid, text, text, timestamptz, timestamptz, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_customer_coupon_stats(uuid, text, text, timestamptz, timestamptz, boolean, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_customer_coupon_stats(uuid, text, text, timestamptz, timestamptz, boolean, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_basket_pairs(uuid, timestamptz, timestamptz, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_basket_pairs(uuid, timestamptz, timestamptz, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_catalog_quality(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_catalog_quality(uuid) TO service_role;
