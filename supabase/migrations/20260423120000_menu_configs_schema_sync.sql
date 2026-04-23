-- Sync menu_configs to current dev schema (adds id/scope/site_id columns)
-- Idempotent: safe to run against any state of the table.

-- 1. Add missing columns
ALTER TABLE public.menu_configs ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.menu_configs ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'global';
ALTER TABLE public.menu_configs ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;

-- 2. Backfill id for any existing rows
UPDATE public.menu_configs SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.menu_configs ALTER COLUMN id SET NOT NULL;

-- 3. Swap primary key from role → id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.menu_configs'::regclass
      AND contype = 'p'
      AND conname = 'menu_configs_pkey'
  ) THEN
    -- Check if current PK is on role alone
    IF (
      SELECT array_agg(a.attname ORDER BY a.attname)
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.conrelid = 'public.menu_configs'::regclass
        AND c.contype = 'p'
    ) = ARRAY['role']::name[] THEN
      ALTER TABLE public.menu_configs DROP CONSTRAINT menu_configs_pkey;
      ALTER TABLE public.menu_configs ADD CONSTRAINT menu_configs_pkey PRIMARY KEY (id);
    END IF;
  ELSE
    ALTER TABLE public.menu_configs ADD CONSTRAINT menu_configs_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- 4. Unique indexes replacing the old role-only uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS menu_configs_role_global_key
  ON public.menu_configs (role)
  WHERE scope = 'global' AND site_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS menu_configs_role_site_key
  ON public.menu_configs (role, site_id)
  WHERE scope = 'site' AND site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_configs_scope_site
  ON public.menu_configs (scope, site_id);