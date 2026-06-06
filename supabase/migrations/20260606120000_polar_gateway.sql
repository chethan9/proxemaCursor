-- Polar.sh payment gateway: enum, config tables, plan polar_refs, seed settings

ALTER TYPE public.billing_gateway ADD VALUE IF NOT EXISTS 'polar';

ALTER TABLE public.payment_gateway_config DROP CONSTRAINT IF EXISTS payment_gateway_config_gateway_check;
ALTER TABLE public.payment_gateway_config
  ADD CONSTRAINT payment_gateway_config_gateway_check
  CHECK (gateway IN ('myfatoorah', 'razorpay', 'tap', 'polar'));

ALTER TABLE public.payment_region_routing DROP CONSTRAINT IF EXISTS payment_region_routing_gateway_check;
ALTER TABLE public.payment_region_routing
  ADD CONSTRAINT payment_region_routing_gateway_check
  CHECK (gateway IN ('myfatoorah', 'razorpay', 'tap', 'polar'));

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS polar_refs jsonb NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO public.payment_gateway_settings (gateway_name, enabled, mode)
VALUES ('polar', false, 'test')
ON CONFLICT (gateway_name) DO NOTHING;

INSERT INTO public.payment_gateway_config (gateway, mode, enabled)
VALUES ('polar', 'test', false)
ON CONFLICT (gateway, mode) DO NOTHING;

INSERT INTO public.payment_gateway_config (gateway, mode, enabled)
VALUES ('polar', 'live', false)
ON CONFLICT (gateway, mode) DO NOTHING;

COMMENT ON COLUMN public.plans.polar_refs IS 'Per-env Polar product/price IDs: { sandbox: { product_id, price_id }, production: { ... } }';
