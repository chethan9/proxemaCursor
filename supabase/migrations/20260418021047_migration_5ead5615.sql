-- Helper functions (SECURITY DEFINER to bypass RLS safely)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.current_user_client_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT client_id FROM profiles WHERE id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(perm text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  user_role text;
  role_perms jsonb;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid() AND is_active = true;
  IF user_role IS NULL THEN RETURN false; END IF;
  SELECT permissions INTO role_perms FROM roles WHERE name = user_role;
  IF role_perms IS NULL THEN RETURN false; END IF;
  RETURN role_perms ? '*' OR role_perms ? perm;
END;
$$;

-- Bootstrap: only allows creating first super admin when none exist
CREATE OR REPLACE FUNCTION public.can_bootstrap_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin' AND is_active = true);
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin' AND is_active = true) THEN
    RAISE EXCEPTION 'Super admin already exists - bootstrap disabled';
  END IF;
  UPDATE profiles SET role = 'super_admin', is_active = true WHERE id = auth.uid();
  IF NOT FOUND THEN
    INSERT INTO profiles (id, email, role, is_active)
    SELECT id, email, 'super_admin', true FROM auth.users WHERE id = auth.uid();
  END IF;
END;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, is_active) 
  VALUES (NEW.id, NEW.email, 'user', true) 
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
  AFTER INSERT ON auth.users 
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();