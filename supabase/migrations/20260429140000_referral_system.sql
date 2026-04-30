-- =====================================================================
-- Referral System Schema
-- =====================================================================
-- Adds the referral domain: settings, profiles, attributions, an immutable
-- event ledger, derived balances, and payout requests with approval flow.
-- All ledger writes happen via INSERT-only; balances are recomputed via
-- trigger-driven aggregation. RLS is enforced for both referrers (own data)
-- and super admins (full management).
-- =====================================================================

-- -----------------------------
-- Settings: single-row config (id = 'singleton')
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.referral_settings (
  id text PRIMARY KEY DEFAULT 'singleton' CHECK (id = 'singleton'),
  is_enabled boolean NOT NULL DEFAULT false,
  signup_bonus_minor bigint NOT NULL DEFAULT 0 CHECK (signup_bonus_minor >= 0),
  paid_percentage_bps int NOT NULL DEFAULT 1000 CHECK (paid_percentage_bps >= 0 AND paid_percentage_bps <= 10000),
  paid_percentage_max_minor bigint CHECK (paid_percentage_max_minor IS NULL OR paid_percentage_max_minor >= 0),
  recurring_percentage_bps int NOT NULL DEFAULT 0 CHECK (recurring_percentage_bps >= 0 AND recurring_percentage_bps <= 10000),
  recurring_max_count int NOT NULL DEFAULT 0 CHECK (recurring_max_count >= 0),
  min_payout_minor bigint NOT NULL DEFAULT 0 CHECK (min_payout_minor >= 0),
  payout_currency text NOT NULL DEFAULT 'USD',
  eligibility_window_days int NOT NULL DEFAULT 90 CHECK (eligibility_window_days >= 0),
  reversal_window_days int NOT NULL DEFAULT 30 CHECK (reversal_window_days >= 0),
  require_referrer_paid boolean NOT NULL DEFAULT true,
  payout_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.referral_settings (id) VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_settings_read ON public.referral_settings;
CREATE POLICY referral_settings_read ON public.referral_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS referral_settings_admin_write ON public.referral_settings;
CREATE POLICY referral_settings_admin_write ON public.referral_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS on_referral_settings_touch ON public.referral_settings;
CREATE TRIGGER on_referral_settings_touch
  BEFORE UPDATE ON public.referral_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();


-- -----------------------------
-- Profiles: enrolled referrers (one row per client)
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.referral_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','disabled')),
  has_paid_purchase boolean NOT NULL DEFAULT false,
  first_paid_at timestamptz,
  payout_method text,
  payout_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_profiles_user ON public.referral_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_profiles_status ON public.referral_profiles(status);
CREATE INDEX IF NOT EXISTS idx_referral_profiles_code_lower ON public.referral_profiles((lower(referral_code)));

ALTER TABLE public.referral_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_profiles_self_read ON public.referral_profiles;
CREATE POLICY referral_profiles_self_read ON public.referral_profiles
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR client_id = public.current_user_client_id()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS referral_profiles_self_update ON public.referral_profiles;
CREATE POLICY referral_profiles_self_update ON public.referral_profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR client_id = public.current_user_client_id())
  WITH CHECK (public.is_super_admin() OR client_id = public.current_user_client_id());

DROP POLICY IF EXISTS referral_profiles_admin_all ON public.referral_profiles;
CREATE POLICY referral_profiles_admin_all ON public.referral_profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS on_referral_profiles_touch ON public.referral_profiles;
CREATE TRIGGER on_referral_profiles_touch
  BEFORE UPDATE ON public.referral_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();


-- -----------------------------
-- Attributions: referrer -> referred link (one per referred client)
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  referred_client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  attributed_at timestamptz NOT NULL DEFAULT now(),
  signup_at timestamptz,
  first_paid_subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  first_paid_at timestamptz,
  converted boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  CONSTRAINT no_self_referral CHECK (referrer_client_id <> referred_client_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_attr_referrer ON public.referral_attributions(referrer_client_id);
CREATE INDEX IF NOT EXISTS idx_referral_attr_code ON public.referral_attributions((lower(referral_code)));
CREATE INDEX IF NOT EXISTS idx_referral_attr_first_paid ON public.referral_attributions(first_paid_at);

ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_attr_referrer_read ON public.referral_attributions;
CREATE POLICY referral_attr_referrer_read ON public.referral_attributions
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR referrer_client_id = public.current_user_client_id()
    OR referred_client_id = public.current_user_client_id()
  );

DROP POLICY IF EXISTS referral_attr_admin_all ON public.referral_attributions;
CREATE POLICY referral_attr_admin_all ON public.referral_attributions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());


-- -----------------------------
-- Events: immutable ledger
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  referred_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  attribution_id uuid REFERENCES public.referral_attributions(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'invite_accepted',
    'signup_bonus',
    'paid_conversion',
    'recurring_bonus',
    'reversal',
    'manual_adjustment',
    'payout_debit',
    'payout_reversal'
  )),
  amount_minor bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted','reversed')),
  source text NOT NULL,
  source_ref text,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  payout_request_id uuid,
  reverses_event_id uuid REFERENCES public.referral_events(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce idempotency for webhook-derived events when source_ref provided
CREATE UNIQUE INDEX IF NOT EXISTS uniq_referral_events_source
  ON public.referral_events(source, source_ref)
  WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON public.referral_events(referrer_client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_events_payout ON public.referral_events(payout_request_id) WHERE payout_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referral_events_currency ON public.referral_events(referrer_client_id, currency);

ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

-- Ledger is read-only for referrers; only service role / super admin write.
DROP POLICY IF EXISTS referral_events_referrer_read ON public.referral_events;
CREATE POLICY referral_events_referrer_read ON public.referral_events
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR referrer_client_id = public.current_user_client_id()
  );

DROP POLICY IF EXISTS referral_events_admin_all ON public.referral_events;
CREATE POLICY referral_events_admin_all ON public.referral_events
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());


-- -----------------------------
-- Balances: derived per (referrer, currency)
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.referral_balances (
  referrer_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'USD',
  lifetime_earned_minor bigint NOT NULL DEFAULT 0,
  reversed_minor bigint NOT NULL DEFAULT 0,
  withdrawn_minor bigint NOT NULL DEFAULT 0,
  pending_payout_minor bigint NOT NULL DEFAULT 0,
  available_minor bigint GENERATED ALWAYS AS (
    GREATEST(0, lifetime_earned_minor - reversed_minor - withdrawn_minor - pending_payout_minor)
  ) STORED,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (referrer_client_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_referral_balances_currency ON public.referral_balances(currency);

ALTER TABLE public.referral_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_balances_self_read ON public.referral_balances;
CREATE POLICY referral_balances_self_read ON public.referral_balances
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR referrer_client_id = public.current_user_client_id()
  );

DROP POLICY IF EXISTS referral_balances_admin_all ON public.referral_balances;
CREATE POLICY referral_balances_admin_all ON public.referral_balances
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());


-- -----------------------------
-- Payout requests
-- -----------------------------
CREATE TABLE IF NOT EXISTS public.referral_payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  currency text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid','canceled')),
  payout_method text,
  payout_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz,
  paid_reference text,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_payout_referrer ON public.referral_payout_requests(referrer_client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_payout_status ON public.referral_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_referral_payout_pending ON public.referral_payout_requests(created_at DESC) WHERE status IN ('pending','approved');

ALTER TABLE public.referral_payout_requests ENABLE ROW LEVEL SECURITY;

-- Now that the table exists we can add the FK constraint from events
ALTER TABLE public.referral_events
  DROP CONSTRAINT IF EXISTS referral_events_payout_request_fk;
ALTER TABLE public.referral_events
  ADD CONSTRAINT referral_events_payout_request_fk
  FOREIGN KEY (payout_request_id)
  REFERENCES public.referral_payout_requests(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS referral_payout_self_read ON public.referral_payout_requests;
CREATE POLICY referral_payout_self_read ON public.referral_payout_requests
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR referrer_client_id = public.current_user_client_id()
  );

DROP POLICY IF EXISTS referral_payout_self_insert ON public.referral_payout_requests;
CREATE POLICY referral_payout_self_insert ON public.referral_payout_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    referrer_client_id = public.current_user_client_id()
    AND requested_by = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS referral_payout_self_cancel ON public.referral_payout_requests;
CREATE POLICY referral_payout_self_cancel ON public.referral_payout_requests
  FOR UPDATE TO authenticated
  USING (
    referrer_client_id = public.current_user_client_id()
    AND status = 'pending'
  )
  WITH CHECK (
    referrer_client_id = public.current_user_client_id()
    AND status IN ('pending','canceled')
  );

DROP POLICY IF EXISTS referral_payout_admin_all ON public.referral_payout_requests;
CREATE POLICY referral_payout_admin_all ON public.referral_payout_requests
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS on_referral_payout_touch ON public.referral_payout_requests;
CREATE TRIGGER on_referral_payout_touch
  BEFORE UPDATE ON public.referral_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();


-- =====================================================================
-- Balance recompute trigger
-- =====================================================================
-- Recomputes the (referrer_client_id, currency) row from referral_events +
-- referral_payout_requests. Invoked on any change in either source table.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.recompute_referral_balance(p_client_id uuid, p_currency text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_lifetime bigint := 0;
  v_reversed bigint := 0;
  v_withdrawn bigint := 0;
  v_pending bigint := 0;
BEGIN
  IF p_client_id IS NULL OR p_currency IS NULL THEN RETURN; END IF;

  SELECT
    COALESCE(SUM(CASE
      WHEN status = 'posted' AND event_type IN ('signup_bonus','paid_conversion','recurring_bonus','manual_adjustment')
        AND amount_minor > 0 THEN amount_minor
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN event_type = 'reversal' AND status = 'posted' THEN ABS(amount_minor)
      WHEN event_type IN ('signup_bonus','paid_conversion','recurring_bonus','manual_adjustment')
        AND status = 'reversed' THEN amount_minor
      ELSE 0
    END), 0),
    COALESCE(SUM(CASE
      WHEN event_type = 'payout_debit' AND status = 'posted' THEN ABS(amount_minor)
      ELSE 0
    END), 0)
  INTO v_lifetime, v_reversed, v_withdrawn
  FROM public.referral_events
  WHERE referrer_client_id = p_client_id AND currency = p_currency;

  SELECT COALESCE(SUM(amount_minor), 0) INTO v_pending
  FROM public.referral_payout_requests
  WHERE referrer_client_id = p_client_id
    AND currency = p_currency
    AND status IN ('pending','approved');

  INSERT INTO public.referral_balances (
    referrer_client_id, currency, lifetime_earned_minor, reversed_minor, withdrawn_minor, pending_payout_minor, updated_at
  ) VALUES (
    p_client_id, p_currency, v_lifetime, v_reversed, v_withdrawn, v_pending, now()
  )
  ON CONFLICT (referrer_client_id, currency) DO UPDATE SET
    lifetime_earned_minor = EXCLUDED.lifetime_earned_minor,
    reversed_minor = EXCLUDED.reversed_minor,
    withdrawn_minor = EXCLUDED.withdrawn_minor,
    pending_payout_minor = EXCLUDED.pending_payout_minor,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_referral_event_recompute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_referral_balance(OLD.referrer_client_id, OLD.currency);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_referral_balance(NEW.referrer_client_id, NEW.currency);
  IF TG_OP = 'UPDATE' AND (OLD.referrer_client_id IS DISTINCT FROM NEW.referrer_client_id
                            OR OLD.currency IS DISTINCT FROM NEW.currency) THEN
    PERFORM public.recompute_referral_balance(OLD.referrer_client_id, OLD.currency);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_event_recompute ON public.referral_events;
CREATE TRIGGER trg_referral_event_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.referral_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_referral_event_recompute();

CREATE OR REPLACE FUNCTION public.tg_referral_payout_recompute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_referral_balance(OLD.referrer_client_id, OLD.currency);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_referral_balance(NEW.referrer_client_id, NEW.currency);
  IF TG_OP = 'UPDATE' AND (OLD.referrer_client_id IS DISTINCT FROM NEW.referrer_client_id
                            OR OLD.currency IS DISTINCT FROM NEW.currency) THEN
    PERFORM public.recompute_referral_balance(OLD.referrer_client_id, OLD.currency);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referral_payout_recompute ON public.referral_payout_requests;
CREATE TRIGGER trg_referral_payout_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.referral_payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_referral_payout_recompute();


-- =====================================================================
-- Helper function: generate a unique short referral code
-- =====================================================================
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_seed text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_code text;
  v_attempts int := 0;
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_len int := 8;
BEGIN
  LOOP
    v_attempts := v_attempts + 1;
    v_code := '';
    FOR i IN 1..v_len LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.referral_profiles WHERE upper(referral_code) = v_code) THEN
      RETURN v_code;
    END IF;
    IF v_attempts > 20 THEN
      v_code := v_code || to_char(extract(epoch FROM clock_timestamp())::bigint, 'FM0000000000');
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;
