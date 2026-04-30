-- Allow any authenticated user to change global UI theme preset only (not branding colors / billing).
-- Direct UPDATE on app_settings remains super-admin-only via RLS.

CREATE OR REPLACE FUNCTION public.set_global_theme_preset(p_theme text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_theme IS NULL OR btrim(p_theme) = '' THEN
    RAISE EXCEPTION 'Invalid theme';
  END IF;
  IF lower(btrim(p_theme)) NOT IN ('classic', 'modern') THEN
    RAISE EXCEPTION 'Invalid theme preset';
  END IF;

  UPDATE public.app_settings
  SET
    theme_preset = lower(btrim(p_theme)),
    updated_at = now()
  WHERE id = 'global';
END;
$$;

REVOKE ALL ON FUNCTION public.set_global_theme_preset(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_global_theme_preset(text) TO authenticated;

COMMENT ON FUNCTION public.set_global_theme_preset(text) IS
  'Sets app_settings.theme_preset for the global row. Available to all signed-in users; other app_settings columns remain protected by RLS.';
