ALTER TABLE stores ADD COLUMN IF NOT EXISTS screenshot_url text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS screenshot_captured_at timestamptz;

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-screenshots', 'site-screenshots', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "site_screenshots_public_read" ON storage.objects;
CREATE POLICY "site_screenshots_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'site-screenshots');

DROP POLICY IF EXISTS "site_screenshots_service_write" ON storage.objects;
CREATE POLICY "site_screenshots_service_write" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'site-screenshots') WITH CHECK (bucket_id = 'site-screenshots');