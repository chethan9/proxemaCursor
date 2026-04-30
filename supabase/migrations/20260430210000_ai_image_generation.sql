-- AI image generation: features, credentials, credits, generations, staging bucket

-- Plans / subscriptions: monthly AI credits (parallel to max_api_calls_per_month pattern)
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS monthly_ai_credits integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.plans.monthly_ai_credits IS 'Credits granted each billing period for AI image generation; consumed before top-up balance.';

ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS ai_credits_used_this_period integer NOT NULL DEFAULT 0;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS ai_credits_topup_balance integer NOT NULL DEFAULT 0;

-- Provider keys (global, super-admin; encrypted like payment gateways)
CREATE TABLE IF NOT EXISTS public.ai_provider_credentials (
  provider text PRIMARY KEY CHECK (provider IN ('google_gemini', 'openai_image')),
  api_key_encrypted text,
  extra jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Admin-defined AI features (prompts, costs)
CREATE TABLE IF NOT EXISTS public.ai_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  provider text NOT NULL CHECK (provider IN ('google_gemini', 'openai_image')),
  model text NOT NULL,
  prompt_template text NOT NULL,
  default_output_count integer NOT NULL DEFAULT 1,
  supports_main boolean NOT NULL DEFAULT true,
  supports_gallery boolean NOT NULL DEFAULT true,
  credit_cost_per_output integer NOT NULL DEFAULT 1 CHECK (credit_cost_per_output > 0),
  user_input_schema jsonb NOT NULL DEFAULT '{"fields":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_features_active ON public.ai_features (is_active, sort_order);

-- Purchased credit packs (top-up)
CREATE TABLE IF NOT EXISTS public.ai_credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  credits integer NOT NULL CHECK (credits > 0),
  amount_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  gateway text,
  gateway_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_credit_purchases_client ON public.ai_credit_purchases (client_id, created_at DESC);

-- Generation jobs
CREATE TABLE IF NOT EXISTS public.ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  feature_id uuid NOT NULL REFERENCES public.ai_features(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  input_image_urls text[] NOT NULL DEFAULT '{}',
  user_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_storage_paths text[] NOT NULL DEFAULT '{}',
  output_wp_ids integer[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'approved', 'partially_approved', 'rejected')),
  provider text,
  model text,
  prompt_used text,
  credits_spent integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_generations_client ON public.ai_generations (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_generations_store_product ON public.ai_generations (store_id, product_id);

-- Atomic credit consumption: monthly allowance first, then top-up balance
CREATE OR REPLACE FUNCTION public.consume_ai_credits(p_client_id uuid, p_credits integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id uuid;
  v_plan_monthly integer;
  v_used integer;
  v_topup integer;
  v_monthly_avail integer;
  v_take_m integer;
  v_take_t integer;
  v_need integer;
BEGIN
  IF p_credits IS NULL OR p_credits <= 0 THEN
    RETURN true;
  END IF;

  SELECT s.id, COALESCE(p.monthly_ai_credits, 0), COALESCE(s.ai_credits_used_this_period, 0), COALESCE(s.ai_credits_topup_balance, 0)
  INTO v_sub_id, v_plan_monthly, v_used, v_topup
  FROM public.subscriptions s
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE s.client_id = p_client_id
    AND s.status IN ('trialing', 'active', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    RETURN false;
  END IF;

  v_monthly_avail := GREATEST(0, v_plan_monthly - v_used);
  v_need := p_credits;
  v_take_m := LEAST(v_need, v_monthly_avail);
  v_need := v_need - v_take_m;
  v_take_t := LEAST(v_need, v_topup);

  IF v_take_m + v_take_t < p_credits THEN
    RETURN false;
  END IF;

  UPDATE public.subscriptions
  SET
    ai_credits_used_this_period = COALESCE(ai_credits_used_this_period, 0) + v_take_m,
    ai_credits_topup_balance = COALESCE(ai_credits_topup_balance, 0) - v_take_t,
    updated_at = now()
  WHERE id = v_sub_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_credits(uuid, integer) TO service_role;

-- Seed five features (prompts are starters; super-admin edits in UI)
INSERT INTO public.ai_features (slug, name, description, sort_order, provider, model, prompt_template, default_output_count, supports_main, supports_gallery, credit_cost_per_output, user_input_schema)
VALUES
(
  'model_replacement',
  'Model replacement',
  'Swap people/models in the shot while keeping the product faithful.',
  10,
  'google_gemini',
  'gemini-2.5-flash-image-preview',
  'Photorealistic ecommerce photo. Keep the product identical in shape, branding, and colors. Replace only the human model: {{user_input.gender}} presentation, {{user_input.style}} style. Scene: neutral studio. Product name hint: {{product_name}}.',
  1,
  true,
  true,
  2,
  '{"fields":[{"key":"gender","label":"Gender / presentation","type":"select","options":["female","male","any"]},{"key":"style","label":"Style","type":"select","options":["casual","athletic","streetwear","business"]}]}'::jsonb
),
(
  'real_scene',
  'Product in real scene',
  'Place the product into a lifestyle environment.',
  20,
  'google_gemini',
  'gemini-2.5-flash-image-preview',
  'Photorealistic lifestyle product shot. Integrate the product naturally into: {{user_input.scene}}. Lighting matches environment. No extra logos. Product: {{product_name}}.',
  1,
  true,
  true,
  2,
  '{"fields":[{"key":"scene","label":"Scene","type":"select","options":["modern living room","kitchen counter","home gym","urban street","coffee shop","outdoor park"]}]}'::jsonb
),
(
  'auto_gallery',
  'Auto gallery generator',
  'Generate a cohesive set of marketing angles from one hero image.',
  30,
  'openai_image',
  'gpt-image-1',
  'Professional ecommerce gallery set for {{product_name}}. Style: {{user_input.vibe}}. Output variation {{index}} of {{total}} — match product geometry and branding.',
  4,
  true,
  true,
  3,
  '{"fields":[{"key":"vibe","label":"Brand vibe","type":"select","options":["minimal","luxury","playful","outdoor"]}]}'::jsonb
),
(
  'angle_generator',
  'Angle generator',
  'New camera angles from one flat product shot.',
  40,
  'google_gemini',
  'gemini-2.5-flash-image-preview',
  'Same product, new camera angle: {{user_input.angle}}. Maintain materials and labels. Studio lighting, soft shadows. Product: {{product_name}}.',
  1,
  true,
  true,
  1,
  '{"fields":[{"key":"angle","label":"Angle","type":"select","options":["front","three-quarter","side","top-down","45-degree"]}]}'::jsonb
),
(
  'hand_usage_shot',
  'Hand / usage shot',
  'Show the product held or in use.',
  50,
  'google_gemini',
  'gemini-2.5-flash-image-preview',
  'Photorealistic usage shot: {{user_input.usage}}. Hands/skin natural; product is hero and in focus. Product: {{product_name}}.',
  1,
  true,
  true,
  2,
  '{"fields":[{"key":"usage","label":"Usage","type":"select","options":["held in hand","on wrist","being applied","in use at desk","worn"]}]}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- RLS
ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_provider_creds_super ON public.ai_provider_credentials;
CREATE POLICY ai_provider_creds_super ON public.ai_provider_credentials
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS ai_features_read ON public.ai_features;
CREATE POLICY ai_features_read ON public.ai_features
  FOR SELECT TO authenticated USING (is_active = true OR public.is_super_admin());

DROP POLICY IF EXISTS ai_features_admin ON public.ai_features;
CREATE POLICY ai_features_admin ON public.ai_features
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS ai_credit_purchases_client ON public.ai_credit_purchases;
CREATE POLICY ai_credit_purchases_client ON public.ai_credit_purchases
  FOR SELECT TO authenticated USING (client_id = public.current_user_client_id() OR public.is_super_admin());

DROP POLICY IF EXISTS ai_credit_purchases_admin ON public.ai_credit_purchases;
CREATE POLICY ai_credit_purchases_admin ON public.ai_credit_purchases
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS ai_gen_client_select ON public.ai_generations;
CREATE POLICY ai_gen_client_select ON public.ai_generations
  FOR SELECT TO authenticated USING (client_id = public.current_user_client_id() OR public.is_super_admin());

DROP POLICY IF EXISTS ai_gen_client_insert ON public.ai_generations;
CREATE POLICY ai_gen_client_insert ON public.ai_generations
  FOR INSERT TO authenticated WITH CHECK (client_id = public.current_user_client_id());

DROP POLICY IF EXISTS ai_gen_admin ON public.ai_generations;
CREATE POLICY ai_gen_admin ON public.ai_generations
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Private staging bucket for generated blobs before WP upload
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-staging',
  'ai-staging',
  false,
  20971520,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS ai_staging_select_own ON storage.objects;
CREATE POLICY ai_staging_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ai-staging'
    AND (
      (string_to_array(name, '/'))[1] = public.current_user_client_id()::text
      OR public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS ai_staging_insert_own ON storage.objects;
CREATE POLICY ai_staging_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ai-staging'
    AND (
      (string_to_array(name, '/'))[1] = public.current_user_client_id()::text
      OR public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS ai_staging_delete_own ON storage.objects;
CREATE POLICY ai_staging_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ai-staging'
    AND (
      (string_to_array(name, '/'))[1] = public.current_user_client_id()::text
      OR public.is_super_admin()
    )
  );

DROP POLICY IF EXISTS ai_staging_service ON storage.objects;
CREATE POLICY ai_staging_service ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'ai-staging')
  WITH CHECK (bucket_id = 'ai-staging');
