-- Add id column and restructure menu_configs for multi-scope support
ALTER TABLE menu_configs ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE menu_configs ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global';
ALTER TABLE menu_configs ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES stores(id) ON DELETE CASCADE;

-- Drop old PK on role, add PK on id
ALTER TABLE menu_configs DROP CONSTRAINT IF EXISTS menu_configs_pkey;
UPDATE menu_configs SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE menu_configs ALTER COLUMN id SET NOT NULL;
ALTER TABLE menu_configs ADD PRIMARY KEY (id);

-- Add check constraint for scope
ALTER TABLE menu_configs DROP CONSTRAINT IF EXISTS menu_configs_scope_check;
ALTER TABLE menu_configs ADD CONSTRAINT menu_configs_scope_check CHECK (scope IN ('global', 'site'));

-- Partial unique indexes for upsert support
DROP INDEX IF EXISTS menu_configs_global_role_uniq;
DROP INDEX IF EXISTS menu_configs_site_default_role_uniq;
DROP INDEX IF EXISTS menu_configs_site_specific_uniq;

CREATE UNIQUE INDEX menu_configs_global_role_uniq ON menu_configs (role) WHERE scope = 'global';
CREATE UNIQUE INDEX menu_configs_site_default_role_uniq ON menu_configs (role) WHERE scope = 'site' AND site_id IS NULL;
CREATE UNIQUE INDEX menu_configs_site_specific_uniq ON menu_configs (role, site_id) WHERE scope = 'site' AND site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_configs_scope_site ON menu_configs (scope, site_id);