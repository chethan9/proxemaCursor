-- Templates foundation: templates, template_versions, template_renders

CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  is_sample boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  description text NULL,
  type text NOT NULL CHECK (type IN ('invoice','pickslip','email','report')),
  is_default_for_type boolean NOT NULL DEFAULT false,
  current_version_id uuid NULL,
  thumbnail_url text NULL,
  print_mode text NOT NULL DEFAULT 'pdf' CHECK (print_mode IN ('pdf','html')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_templates_client ON public.templates(client_id);
CREATE INDEX IF NOT EXISTS idx_templates_type ON public.templates(type, is_sample);
CREATE INDEX IF NOT EXISTS idx_templates_default ON public.templates(client_id, type, is_default_for_type) WHERE is_default_for_type = true;

CREATE TABLE IF NOT EXISTS public.template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  document jsonb NOT NULL DEFAULT '{}'::jsonb,
  styles jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template ON public.template_versions(template_id, version_number DESC);

ALTER TABLE public.templates 
  ADD CONSTRAINT templates_current_version_fkey 
  FOREIGN KEY (current_version_id) REFERENCES public.template_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.template_renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  version_id uuid NULL REFERENCES public.template_versions(id) ON DELETE SET NULL,
  client_id uuid NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NULL,
  output_format text NOT NULL DEFAULT 'pdf',
  output_url text NULL,
  output_size_bytes integer NULL,
  rendered_at timestamptz NOT NULL DEFAULT now(),
  rendered_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_template_renders_template ON public.template_renders(template_id, rendered_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_renders_client ON public.template_renders(client_id, rendered_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_renders_entity ON public.template_renders(entity_type, entity_id);

-- RLS
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_renders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS templates_select ON public.templates;
CREATE POLICY templates_select ON public.templates FOR SELECT
  USING (is_sample = true OR client_id = current_user_client_id() OR is_super_admin());

DROP POLICY IF EXISTS templates_insert ON public.templates;
CREATE POLICY templates_insert ON public.templates FOR INSERT
  WITH CHECK ((is_sample = false AND client_id = current_user_client_id()) OR is_super_admin());

DROP POLICY IF EXISTS templates_update ON public.templates;
CREATE POLICY templates_update ON public.templates FOR UPDATE
  USING ((is_sample = false AND client_id = current_user_client_id()) OR is_super_admin())
  WITH CHECK ((is_sample = false AND client_id = current_user_client_id()) OR is_super_admin());

DROP POLICY IF EXISTS templates_delete ON public.templates;
CREATE POLICY templates_delete ON public.templates FOR DELETE
  USING ((is_sample = false AND client_id = current_user_client_id()) OR is_super_admin());

DROP POLICY IF EXISTS template_versions_select ON public.template_versions;
CREATE POLICY template_versions_select ON public.template_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.templates t WHERE t.id = template_id AND (t.is_sample = true OR t.client_id = current_user_client_id() OR is_super_admin())));

DROP POLICY IF EXISTS template_versions_insert ON public.template_versions;
CREATE POLICY template_versions_insert ON public.template_versions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.templates t WHERE t.id = template_id AND ((t.is_sample = false AND t.client_id = current_user_client_id()) OR is_super_admin())));

DROP POLICY IF EXISTS template_versions_update ON public.template_versions;
CREATE POLICY template_versions_update ON public.template_versions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.templates t WHERE t.id = template_id AND ((t.is_sample = false AND t.client_id = current_user_client_id()) OR is_super_admin())));

DROP POLICY IF EXISTS template_renders_select ON public.template_renders;
CREATE POLICY template_renders_select ON public.template_renders FOR SELECT
  USING (client_id = current_user_client_id() OR is_super_admin());

DROP POLICY IF EXISTS template_renders_insert ON public.template_renders;
CREATE POLICY template_renders_insert ON public.template_renders FOR INSERT
  WITH CHECK (client_id = current_user_client_id() OR is_super_admin() OR client_id IS NULL);