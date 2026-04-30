-- Populate profiles.full_name and profiles.avatar_url from auth.users.raw_user_meta_data
-- so OAuth providers (Google, etc.) and email signups that pass full_name in
-- options.data both produce a fully-populated profile on first INSERT.
--
-- Google's OAuth claims land in raw_user_meta_data as:
--   full_name      (preferred), or  name
--   avatar_url     (preferred), or  picture
--
-- Email signups pass options.data.full_name from src/pages/auth/signup.tsx.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_full_name text;
  v_avatar_url text;
BEGIN
  v_full_name := NULLIF(COALESCE(meta->>'full_name', meta->>'name'), '');
  v_avatar_url := NULLIF(COALESCE(meta->>'avatar_url', meta->>'picture'), '');

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, is_active)
  VALUES (NEW.id, NEW.email, v_full_name, v_avatar_url, 'user', true)
  ON CONFLICT (id) DO UPDATE
    SET full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);
  RETURN NEW;
END;
$function$;
