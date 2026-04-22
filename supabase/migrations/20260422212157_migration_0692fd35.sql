CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_interval text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
  max_sites int NOT NULL DEFAULT 1,
  max_products_per_site int NOT NULL DEFAULT 100,
  max_users int NOT NULL DEFAULT 1,
  max_api_calls_per_month int NOT NULL DEFAULT 10000,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  trial_days int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_custom boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_sort ON public.plans (sort_order, is_active);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_public_read ON public.plans;
CREATE POLICY plans_public_read ON public.plans
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS plans_admin_all ON public.plans;
CREATE POLICY plans_admin_all ON public.plans
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS on_plans_change ON public.plans;
CREATE TRIGGER on_plans_change
  AFTER INSERT OR UPDATE OR DELETE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.log_change_generic();

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS on_plans_touch ON public.plans;
CREATE TRIGGER on_plans_touch
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

INSERT INTO public.plans (slug, name, description, prices, max_sites, max_products_per_site, max_users, max_api_calls_per_month, features, trial_days, is_custom, sort_order) VALUES
  ('starter', 'Starter', 'For solo makers testing the waters',
    '{"USD":900,"INR":79900,"KWD":300,"SAR":3400,"AED":3300}'::jsonb,
    1, 500, 1, 10000,
    '{"priority_support":false,"custom_domain":false,"advanced_webhooks":false}'::jsonb,
    14, false, 10),
  ('growth', 'Growth', 'For growing teams with multiple stores',
    '{"USD":2900,"INR":240000,"KWD":900,"SAR":11000,"AED":11000}'::jsonb,
    3, 5000, 5, 100000,
    '{"priority_support":false,"custom_domain":false,"advanced_webhooks":true}'::jsonb,
    14, false, 20),
  ('scale', 'Scale', 'For agencies running many stores at once',
    '{"USD":9900,"INR":820000,"KWD":3000,"SAR":37000,"AED":36000}'::jsonb,
    10, 25000, 20, 500000,
    '{"priority_support":true,"custom_domain":true,"advanced_webhooks":true}'::jsonb,
    14, false, 30),
  ('enterprise', 'Enterprise', 'Custom pricing, dedicated support, SLA',
    '{}'::jsonb,
    999999, 999999, 999999, 999999,
    '{"priority_support":true,"custom_domain":true,"advanced_webhooks":true,"sla":true,"dedicated_csm":true}'::jsonb,
    0, true, 40)
ON CONFLICT (slug) DO NOTHING;