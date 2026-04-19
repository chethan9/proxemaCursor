ALTER TABLE stores ADD COLUMN IF NOT EXISTS logo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('site-logos', 'site-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "site-logos public read" ON storage.objects;
CREATE POLICY "site-logos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-logos');

DROP POLICY IF EXISTS "site-logos auth upload" ON storage.objects;
CREATE POLICY "site-logos auth upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'site-logos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "site-logos auth update" ON storage.objects;
CREATE POLICY "site-logos auth update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'site-logos' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "site-logos auth delete" ON storage.objects;
CREATE POLICY "site-logos auth delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'site-logos' AND auth.uid() IS NOT NULL);