DROP POLICY IF EXISTS "public_read_stores" ON stores;
DROP POLICY IF EXISTS "public_insert_stores" ON stores;
DROP POLICY IF EXISTS "public_update_stores" ON stores;
DROP POLICY IF EXISTS "public_delete_stores" ON stores;

DROP POLICY IF EXISTS "public_read_clients" ON clients;
DROP POLICY IF EXISTS "public_insert_clients" ON clients;
DROP POLICY IF EXISTS "public_update_clients" ON clients;
DROP POLICY IF EXISTS "public_delete_clients" ON clients;

SELECT p.id, p.email, p.role, p.client_id FROM profiles p;