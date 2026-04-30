-- Super-admin "developer mode": when true, billing enforcement and quota limits
-- behave as if enforcement is off, without mutating billing_enforcement_enabled.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS billing_dev_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.app_settings.billing_dev_mode IS
  'When true, plan/subscription gates and quota checks are relaxed app-wide for QA (super-admin toggle).';
