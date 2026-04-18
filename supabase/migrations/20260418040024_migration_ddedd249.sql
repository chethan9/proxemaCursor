CREATE OR REPLACE FUNCTION public.auto_create_client_for_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_client_id uuid;
  display_name text;
BEGIN
  IF NEW.role = 'super_admin' OR NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  display_name := COALESCE(NULLIF(NEW.full_name, ''), split_part(NEW.email, '@', 1), 'My Workspace');

  INSERT INTO public.clients (name, slug)
  VALUES (display_name, lower(regexp_replace(display_name || '-' || substr(NEW.id::text, 1, 8), '[^a-z0-9]+', '-', 'g')))
  RETURNING id INTO new_client_id;

  NEW.client_id := new_client_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_client ON public.profiles;
CREATE TRIGGER trg_auto_create_client
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_client_for_profile();