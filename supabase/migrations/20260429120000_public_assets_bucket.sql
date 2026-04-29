-- Branding + profile avatar uploads (see settings/branding.tsx, settings/profile.tsx)
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-assets', 'public-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public-assets public read" ON storage.objects;
CREATE POLICY "public-assets public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'public-assets');

DROP POLICY IF EXISTS "public-assets auth upload" ON storage.objects;
CREATE POLICY "public-assets auth upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'public-assets' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "public-assets auth update" ON storage.objects;
CREATE POLICY "public-assets auth update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'public-assets' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "public-assets auth delete" ON storage.objects;
CREATE POLICY "public-assets auth delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'public-assets' AND auth.uid() IS NOT NULL);
