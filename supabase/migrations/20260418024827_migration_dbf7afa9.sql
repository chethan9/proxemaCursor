-- Recreate helpers as SECURITY DEFINER to bypass RLS recursion
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_client_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT client_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_store(p_store_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = p_store_id
    AND (s.client_id IS NULL OR s.client_id = public.current_user_client_id())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_client_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_store(uuid) TO authenticated, anon;

-- Simplify profiles RLS to avoid recursion
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid() OR public.is_super_admin());