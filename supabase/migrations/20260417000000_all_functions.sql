-- All function definitions pulled from live dev DB so triggers have their dependencies available at build time.
-- Uses CREATE OR REPLACE so re-running is safe.

-- Function: auto_create_client_for_profile
CREATE OR REPLACE FUNCTION public.auto_create_client_for_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_client_id uuid;
  client_name text;
BEGIN
  IF NEW.role = 'super_admin' OR NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  client_name := COALESCE(NULLIF(NEW.full_name, ''), split_part(NEW.email, '@', 1));
  INSERT INTO public.clients (name) VALUES (client_name) RETURNING id INTO new_client_id;
  NEW.client_id := new_client_id;
  RETURN NEW;
END;
$function$;

-- Function: bootstrap_super_admin
CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Super admin already exists - bootstrap disabled';
  END IF;
  UPDATE profiles SET role = 'super_admin', is_active = true WHERE id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO profiles (id, email, role, is_active)
    SELECT id, email, 'super_admin', true FROM auth.users WHERE id = auth.uid();
  END IF;
END;
$function$;

-- Function: can_bootstrap_super_admin
CREATE OR REPLACE FUNCTION public.can_bootstrap_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin' AND is_active = true);
$function$;

-- Function: current_user_client_id
CREATE OR REPLACE FUNCTION public.current_user_client_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$function$;

-- Function: current_user_role
CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true;
$function$;

-- Function: get_site_home_stats
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

-- Function: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, role, is_active)
  VALUES (NEW.id, NEW.email, 'user', true)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Function: has_permission
CREATE OR REPLACE FUNCTION public.has_permission(perm text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  role_perms jsonb;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid() AND is_active = true;
  IF user_role IS NULL THEN RETURN false; END IF;
  SELECT permissions INTO role_perms FROM roles WHERE name = user_role;
  IF role_perms IS NULL THEN RETURN false; END IF;
  RETURN role_perms ? '*' OR role_perms ? perm;
END;
$function$;

-- Function: increment_api_call_count
CREATE OR REPLACE FUNCTION public.increment_api_call_count(p_client_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE subscriptions
  SET api_calls_this_period = api_calls_this_period + 1
  WHERE client_id = p_client_id
    AND status IN ('trialing', 'active', 'past_due');
END;
$function$;

-- Function: increment_coupon_redemption_count
CREATE OR REPLACE FUNCTION public.increment_coupon_redemption_count(coupon_id_in uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ UPDATE public.billing_coupons SET redemptions_count = redemptions_count + 1 WHERE id = coupon_id_in $function$;

-- Function: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$function$;

-- Function: log_branding_change
CREATE OR REPLACE FUNCTION public.log_branding_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor_email text;
BEGIN
  SELECT email INTO actor_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.branding_audit_log (
      changed_by, changed_by_email,
      new_brand_name, new_logo_url, new_theme_preset, new_primary_color
    ) VALUES (
      auth.uid(), actor_email,
      NEW.brand_name, NEW.logo_url, NEW.theme_preset, NEW.primary_color
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.brand_name IS DISTINCT FROM NEW.brand_name
       OR OLD.logo_url IS DISTINCT FROM NEW.logo_url
       OR OLD.theme_preset IS DISTINCT FROM NEW.theme_preset
       OR OLD.primary_color IS DISTINCT FROM NEW.primary_color THEN
      INSERT INTO public.branding_audit_log (
        changed_by, changed_by_email,
        previous_brand_name, new_brand_name,
        previous_logo_url, new_logo_url,
        previous_theme_preset, new_theme_preset,
        previous_primary_color, new_primary_color
      ) VALUES (
        auth.uid(), actor_email,
        OLD.brand_name, NEW.brand_name,
        OLD.logo_url, NEW.logo_url,
        OLD.theme_preset, NEW.theme_preset,
        OLD.primary_color, NEW.primary_color
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Function: log_change_generic
CREATE OR REPLACE FUNCTION public.log_change_generic()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_email text;
  v_entity_id text;
  v_before jsonb;
  v_after jsonb;
  v_diff jsonb;
BEGIN
  SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_entity_id := to_jsonb(NEW) ->> 'id';
    v_diff := jsonb_build_object('after', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := to_jsonb(NEW) ->> 'id';
    SELECT jsonb_object_agg(key, value) INTO v_before
      FROM jsonb_each(to_jsonb(OLD))
      WHERE value IS DISTINCT FROM (to_jsonb(NEW) -> key);
    SELECT jsonb_object_agg(key, value) INTO v_after
      FROM jsonb_each(to_jsonb(NEW))
      WHERE value IS DISTINCT FROM (to_jsonb(OLD) -> key);
    IF v_before IS NULL OR v_before = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
    v_diff := jsonb_build_object('before', v_before, 'after', v_after);
  ELSIF TG_OP = 'DELETE' THEN
    v_entity_id := to_jsonb(OLD) ->> 'id';
    v_diff := jsonb_build_object('before', to_jsonb(OLD));
  END IF;

  INSERT INTO public.activity_log (
    actor_user_id, actor_email, actor_type,
    action, entity_type, entity_id, diff
  ) VALUES (
    auth.uid(), v_actor_email,
    CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END,
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME, v_entity_id, v_diff
  );

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Function: log_profile_role_change
CREATE OR REPLACE FUNCTION public.log_profile_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_email text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  SELECT email INTO v_actor_email FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.activity_log (
    actor_user_id, actor_email, actor_type,
    action, entity_type, entity_id, diff
  ) VALUES (
    auth.uid(), v_actor_email,
    CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END,
    CASE WHEN TG_OP = 'INSERT' THEN 'profile.created' ELSE 'profile.role_changed' END,
    'profile', NEW.id::text,
    jsonb_build_object(
      'before', CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('role', OLD.role) ELSE NULL END,
      'after', jsonb_build_object('role', NEW.role)
    )
  );

  RETURN NEW;
END;
$function$;

-- Function: orders_aggregate_customer_trigger
CREATE OR REPLACE FUNCTION public.orders_aggregate_customer_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$ BEGIN IF TG_OP = 'DELETE' THEN IF OLD.customer_id IS NOT NULL AND OLD.customer_id > 0 THEN PERFORM public.recalc_customer_aggregates(OLD.store_id, OLD.customer_id); END IF; RETURN OLD; END IF; IF NEW.customer_id IS NOT NULL AND NEW.customer_id > 0 THEN PERFORM public.recalc_customer_aggregates(NEW.store_id, NEW.customer_id); END IF; IF TG_OP = 'UPDATE' AND OLD.customer_id IS DISTINCT FROM NEW.customer_id AND OLD.customer_id IS NOT NULL AND OLD.customer_id > 0 THEN PERFORM public.recalc_customer_aggregates(OLD.store_id, OLD.customer_id); END IF; RETURN NEW; END; $function$;

-- Function: recalc_customer_aggregates
CREATE OR REPLACE FUNCTION public.recalc_customer_aggregates(p_store_id uuid, p_customer_woo_id bigint)
 RETURNS void
 LANGUAGE plpgsql
AS $function$ BEGIN UPDATE public.customers c SET orders_count = COALESCE(agg.cnt, 0), total_spent = COALESCE(agg.spent, 0) FROM (SELECT COUNT(*) AS cnt, SUM(CASE WHEN status IN ('completed','processing','on-hold') THEN total::numeric ELSE 0 END) AS spent FROM public.orders WHERE store_id = p_store_id AND customer_id = p_customer_woo_id) agg WHERE c.store_id = p_store_id AND c.woo_id = p_customer_woo_id; END; $function$;

-- Function: tg_touch_updated_at
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- Function: user_can_access_store
CREATE OR REPLACE FUNCTION public.user_can_access_store(p_store_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = p_store_id
    AND (s.client_id IS NULL OR s.client_id = public.current_user_client_id())
  );
$function$;