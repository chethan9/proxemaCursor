-- Global billing controls in app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS billing_enforcement_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quota_grace_days INTEGER NOT NULL DEFAULT 7;

-- First-overage soft-lock timestamp on subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS quota_grace_until TIMESTAMPTZ;

-- Ensure single canonical app_settings row
INSERT INTO public.app_settings (id) VALUES ('global')
ON CONFLICT (id) DO NOTHING;
