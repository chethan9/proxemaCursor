-- Profiles RLS
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_all_super" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_super" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_select_super" ON profiles FOR SELECT USING (is_super_admin());
CREATE POLICY "profiles_update_own_limited" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_update_super" ON profiles FOR UPDATE USING (is_super_admin());
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Roles RLS (super admins manage, everyone reads)
DROP POLICY IF EXISTS "roles_read_all" ON roles;
DROP POLICY IF EXISTS "roles_write_super" ON roles;
CREATE POLICY "roles_read_authenticated" ON roles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "roles_insert_super" ON roles FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "roles_update_super" ON roles FOR UPDATE USING (is_super_admin() AND is_system = false);
CREATE POLICY "roles_delete_super" ON roles FOR DELETE USING (is_super_admin() AND is_system = false);

-- Clients: super sees all, users see their own client
DROP POLICY IF EXISTS "clients_public_read" ON clients;
DROP POLICY IF EXISTS "clients_anon_insert" ON clients;
DROP POLICY IF EXISTS "clients_public_write" ON clients;
CREATE POLICY "clients_select_scoped" ON clients FOR SELECT USING (is_super_admin() OR id = current_user_client_id());
CREATE POLICY "clients_insert_super" ON clients FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clients_update_scoped" ON clients FOR UPDATE USING (is_super_admin() OR id = current_user_client_id());
CREATE POLICY "clients_delete_super" ON clients FOR DELETE USING (is_super_admin());

-- Stores: scoped by client
DROP POLICY IF EXISTS "stores_public_read" ON stores;
DROP POLICY IF EXISTS "stores_public_write" ON stores;
DROP POLICY IF EXISTS "stores_anon_insert" ON stores;
CREATE POLICY "stores_select_scoped" ON stores FOR SELECT USING (is_super_admin() OR client_id = current_user_client_id());
CREATE POLICY "stores_insert_scoped" ON stores FOR INSERT WITH CHECK (is_super_admin() OR client_id = current_user_client_id());
CREATE POLICY "stores_update_scoped" ON stores FOR UPDATE USING (is_super_admin() OR client_id = current_user_client_id());
CREATE POLICY "stores_delete_scoped" ON stores FOR DELETE USING (is_super_admin() OR client_id = current_user_client_id());