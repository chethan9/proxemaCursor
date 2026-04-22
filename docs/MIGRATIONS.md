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
]]>