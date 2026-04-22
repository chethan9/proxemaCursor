DROP POLICY IF EXISTS public_update_settings ON public.app_settings;
DROP POLICY IF EXISTS public_write_settings ON public.app_settings;

CREATE POLICY app_settings_admin_insert ON public.app_settings
  FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY app_settings_admin_update ON public.app_settings
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.branding_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email text,
  previous_brand_name text,
  new_brand_name text,
  previous_logo_url text,
  new_logo_url text,
  previous_theme_preset text,
  new_theme_preset text,
  previous_primary_color text,
  new_primary_color text
);

CREATE INDEX IF NOT EXISTS idx_branding_audit_changed_at ON public.branding_audit_log (changed_at DESC);

ALTER TABLE public.branding_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branding_audit_admin_read ON public.branding_audit_log;
CREATE POLICY branding_audit_admin_read ON public.branding_audit_log
  FOR SELECT USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.log_branding_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;

DROP TRIGGER IF EXISTS on_app_settings_change ON public.app_settings;
CREATE TRIGGER on_app_settings_change
  AFTER INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_branding_change();