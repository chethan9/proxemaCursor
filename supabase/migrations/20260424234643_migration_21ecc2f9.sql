CREATE TABLE IF NOT EXISTS public.payment_gateway_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_name text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  publishable_key text,
  secret_key text,
  webhook_secret text,
  extra_config jsonb DEFAULT '{}'::jsonb,
  country_overrides text[] DEFAULT ARRAY[]::text[],
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_gateway_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_gateway_settings" ON public.payment_gateway_settings;
CREATE POLICY "auth_read_gateway_settings" ON public.payment_gateway_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

INSERT INTO public.payment_gateway_settings (gateway_name, enabled, mode)
VALUES ('myfatoorah', false, 'test'), ('razorpay', false, 'test'), ('tap', false, 'test')
ON CONFLICT (gateway_name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.touch_payment_gateway_settings()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_touch_pgs ON public.payment_gateway_settings;
CREATE TRIGGER trg_touch_pgs BEFORE UPDATE ON public.payment_gateway_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_payment_gateway_settings();