CREATE TABLE IF NOT EXISTS public.locales (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  native_name TEXT NOT NULL,
  dir TEXT NOT NULL DEFAULT 'ltr' CHECK (dir IN ('ltr','rtl')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locale TEXT NOT NULL REFERENCES public.locales(code) ON DELETE CASCADE,
  namespace TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (locale, namespace, key)
);

CREATE INDEX IF NOT EXISTS idx_translations_locale_ns ON public.translations(locale, namespace);
CREATE INDEX IF NOT EXISTS idx_translations_needs_review ON public.translations(needs_review) WHERE needs_review = true;

ALTER TABLE public.locales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS locales_public_read ON public.locales;
CREATE POLICY locales_public_read ON public.locales FOR SELECT USING (true);

DROP POLICY IF EXISTS locales_admin_write ON public.locales;
CREATE POLICY locales_admin_write ON public.locales FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS translations_public_read ON public.translations;
CREATE POLICY translations_public_read ON public.translations FOR SELECT USING (true);

DROP POLICY IF EXISTS translations_admin_write ON public.translations;
CREATE POLICY translations_admin_write ON public.translations FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

INSERT INTO public.locales (code, name, native_name, dir, enabled, is_default) VALUES
  ('en', 'English', 'English', 'ltr', true, true),
  ('ar', 'Arabic', 'العربية', 'rtl', true, false),
  ('es', 'Spanish', 'Español', 'ltr', true, false),
  ('fr', 'French', 'Français', 'ltr', true, false),
  ('de', 'German', 'Deutsch', 'ltr', true, false),
  ('pt', 'Portuguese', 'Português', 'ltr', true, false),
  ('hi', 'Hindi', 'हिन्दी', 'ltr', true, false),
  ('zh', 'Chinese', '中文', 'ltr', true, false),
  ('ja', 'Japanese', '日本語', 'ltr', true, false),
  ('ru', 'Russian', 'Русский', 'ltr', true, false)
ON CONFLICT (code) DO NOTHING;