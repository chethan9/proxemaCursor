# Supabase Migrations — Reliability Checklist

## The real problem (as of 20
...
 to an automated flow later (e.g. GitHub Actions running `supabase db push` on merge to main).

---

## Pending production migrations — 2026-04-22 batch

Two migrations were auto-applied to the dev branch via `execute_sql_query`. Both are additive and safe to re-run (idempotent).

### 1. Site screenshot cache (file: `20260422_site_screenshots.sql`)

**Context:** Added DB-backed cache for site preview images. Frontend calls `GET /api/stores/[storeId]/screenshot`, which reads these columns, captures+uploads to Storage if stale, and returns the public URL.

**SQL to apply in production:**

```sql
-- 1. New columns on stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS screenshot_url text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS screenshot_captured_at timestamptz;

-- 2. Public bucket for screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-screenshots', 'site-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies on storage.objects
CREATE POLICY "site-screenshots-public-read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-screenshots');

CREATE POLICY "site-screenshots-service-write"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'site-screenshots');

CREATE POLICY "site-screenshots-service-update"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'site-screenshots')
  WITH CHECK (bucket_id = 'site-screenshots');
```

**Post-migration verification:**

```sql
-- Confirm columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'stores' AND column_name IN ('screenshot_url', 'screenshot_captured_at');

-- Confirm bucket exists + is public
SELECT id, public FROM storage.buckets WHERE id = 'site-screenshots';

-- Confirm policies
SELECT polname FROM pg_policy WHERE polname LIKE 'site-screenshots%';
```

**Rollback (if needed):**

```sql
DROP POLICY IF EXISTS "site-screenshots-public-read" ON storage.objects;
DROP POLICY IF EXISTS "site-screenshots-service-write" ON storage.objects;
DROP POLICY IF EXISTS "site-screenshots-service-update" ON storage.objects;
-- Leave bucket + columns in place; they are safe and nullable.
-- Hard rollback (destroys any cached screenshots):
-- DELETE FROM storage.objects WHERE bucket_id = 'site-screenshots';
-- DELETE FROM storage.buckets WHERE id = 'site-screenshots';
-- ALTER TABLE stores DROP COLUMN IF EXISTS screenshot_url, DROP COLUMN IF EXISTS screenshot_captured_at;
```

**Environment variables (optional):**

- `THUM_API_KEY` — if set, the capture API uses the authenticated thum.io endpoint for higher rate limits and better capture quality. Without it, the free public endpoint is used (works but may be slower / rate-limited under load).

**Operational notes:**

- First fetch per store is slow (10–20s while thum.io captures). Subsequent fetches for 7 days are instant (Supabase CDN).
- If thum.io fails and a stale URL exists, the API returns the stale URL as fallback — the UI never breaks.
- Each store uses ~50–200 KB of Storage. 1000 stores ≈ 100–200 MB total. Negligible cost.
- If you ever need to force-refresh a specific store's screenshot, `UPDATE stores SET screenshot_captured_at = NULL WHERE id = '<uuid>'`.

### 2. No other schema changes in this batch

All other Bugfix2.csv fixes are application-layer only (React/TS) — no DB migration needed.

### 3. Branding admin-only writes + audit log (file: `20260422_branding_audit.sql`)

**Context:** Previously `app_settings` had wide-open RLS (`public_update_settings` / `public_write_settings` with `USING (true)`), meaning any authenticated user could overwrite the global brand. Now writes are locked to super admins, and every change is auto-logged to `branding_audit_log` via a trigger.

**SQL to apply in production:**

```sql
-- 1. Tighten app_settings RLS — drop permissive, add admin-only
DROP POLICY IF EXISTS public_update_settings ON public.app_settings;
DROP POLICY IF EXISTS public_write_settings ON public.app_settings;
-- Keep public_read_settings (SELECT true) so every session can load branding.

CREATE POLICY app_settings_admin_write ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY app_settings_admin_update ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 2. Audit log table
CREATE TABLE IF NOT EXISTS public.branding_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_email text,
  previous_brand_name text,
  new_brand_name text,
  previous_logo_url text,
  new_logo_url text,
  previous_theme_preset text,
  new_theme_preset text
);
CREATE INDEX IF NOT EXISTS idx_branding_audit_changed_at
  ON public.branding_audit_log (changed_at DESC);

ALTER TABLE public.branding_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY branding_audit_admin_read ON public.branding_audit_log
  FOR SELECT TO authenticated USING (public.is_super_admin());
-- No INSERT policy — only the SECURITY DEFINER trigger writes.

-- 3. Auto-log trigger
CREATE OR REPLACE FUNCTION public.log_branding_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_email text;
BEGIN
  SELECT email INTO user_email FROM public.profiles WHERE id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.branding_audit_log
      (changed_by, changed_by_email, new_brand_name, new_logo_url, new_theme_preset)
    VALUES (auth.uid(), user_email, NEW.brand_name, NEW.logo_url, NEW.theme_preset);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.brand_name IS DISTINCT FROM NEW.brand_name
       OR OLD.logo_url IS DISTINCT FROM NEW.logo_url
       OR OLD.theme_preset IS DISTINCT FROM NEW.theme_preset THEN
      INSERT INTO public.branding_audit_log
        (changed_by, changed_by_email,
         previous_brand_name, new_brand_name,
         previous_logo_url, new_logo_url,
         previous_theme_preset, new_theme_preset)
      VALUES (auth.uid(), user_email,
              OLD.brand_name, NEW.brand_name,
              OLD.logo_url, NEW.logo_url,
              OLD.theme_preset, NEW.theme_preset);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_app_settings_change ON public.app_settings;
CREATE TRIGGER on_app_settings_change
  AFTER INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_branding_change();
```

**Post-migration verification:**

```sql
-- Confirm permissive policies are gone
SELECT polname FROM pg_policy
 WHERE polrelid = 'public.app_settings'::regclass;
-- Expected: app_settings_admin_update, app_settings_admin_write, public_read_settings

-- Confirm audit table + trigger
SELECT tgname FROM pg_trigger WHERE tgname = 'on_app_settings_change';
SELECT COUNT(*) FROM public.branding_audit_log;

-- Smoke test as a non-admin (should fail):
-- UPDATE public.app_settings SET brand_name = 'hack' WHERE id = 'global';
-- Expected: ERROR: new row violates row-level security policy
```

**Rollback:**

```sql
DROP TRIGGER IF EXISTS on_app_settings_change ON public.app_settings;
DROP FUNCTION IF EXISTS public.log_branding_change();
DROP POLICY IF EXISTS branding_audit_admin_read ON public.branding_audit_log;
DROP TABLE IF EXISTS public.branding_audit_log;
DROP POLICY IF EXISTS app_settings_admin_update ON public.app_settings;
DROP POLICY IF EXISTS app_settings_admin_write ON public.app_settings;
-- Restore old permissive policies only if you really want to:
-- CREATE POLICY public_update_settings ON public.app_settings FOR UPDATE USING (true) WITH CHECK (true);
-- CREATE POLICY public_write_settings ON public.app_settings FOR INSERT WITH CHECK (true);
```

**Operational notes:**

- `is_super_admin()` already exists in the DB — if you ever rename it, update this migration too.
- The UI side hides the Theme settings nav item from non-admins and guards the route with `requirePermission={PERMISSIONS.SETTINGS_MANAGE}`. Server-side RLS is the real enforcement; UI guard is only for tidiness.
- `branding_audit_log` grows ~1 row per actual change (no duplicates on identical saves — the trigger checks `IS DISTINCT FROM`). Trim periodically if volume becomes a concern: `DELETE FROM branding_audit_log WHERE changed_at < NOW() - INTERVAL '1 year';`
