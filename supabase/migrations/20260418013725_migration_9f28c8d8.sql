INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "branding_public_read" ON storage.objects;
DROP POLICY IF EXISTS "branding_public_write" ON storage.objects;
DROP POLICY IF EXISTS "branding_public_update" ON storage.objects;
DROP POLICY IF EXISTS "branding_public_delete" ON storage.objects;
CREATE POLICY "branding_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "branding_public_write" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'branding');
CREATE POLICY "branding_public_update" ON storage.objects FOR UPDATE USING (bucket_id = 'branding');
CREATE POLICY "branding_public_delete" ON storage.objects FOR DELETE USING (bucket_id = 'branding');