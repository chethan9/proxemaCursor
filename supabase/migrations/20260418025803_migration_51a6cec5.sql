DROP POLICY IF EXISTS "profiles_delete" ON profiles;
DROP POLICY IF EXISTS "profiles_create" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_select_all_auth" ON profiles;
DROP POLICY IF EXISTS "profiles_select_super" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own_limited" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_super" ON profiles;
DROP POLICY IF EXISTS "profiles_write" ON profiles;

CREATE POLICY "p_select" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "p_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "p_update" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_super_admin()) WITH CHECK (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "p_delete" ON profiles FOR DELETE TO authenticated USING (public.is_super_admin());