CREATE OR REPLACE FUNCTION public.auto_create_client_for_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_client_id uuid;
  client_name text;
BEGIN
  IF NEW.role = 'super_admin' OR NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  client_name := COALESCE(NULLIF(NEW.full_name, ''), split_part(NEW.email, '@', 1));
  INSERT INTO public.clients (name) VALUES (client_name) RETURNING id INTO new_client_id;
  NEW.client_id := new_client_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_auto_client ON public.profiles;
CREATE TRIGGER on_profile_created_auto_client
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_client_for_profile();