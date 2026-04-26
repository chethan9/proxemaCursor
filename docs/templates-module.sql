-- ============================================================================
-- Templates module — full SQL for live database
-- Apply once to a fresh database. Idempotent: safe to re-run (uses IF NOT EXISTS).
-- ============================================================================

-- 1) TABLES -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  is_sample boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('invoice','pickslip','email','report')),
  is_default_for_type boolean NOT NULL DEFAULT false,
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT templates_sample_or_client CHECK (
    (is_sample = true AND client_id IS NULL) OR (is_sample = false AND client_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_templates_client_type ON public.templates(client_id, type);
CREATE INDEX IF NOT EXISTS idx_templates_sample_type ON public.templates(is_sample, type) WHERE is_sample = true;

CREATE TABLE IF NOT EXISTS public.template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  document jsonb NOT NULL,
  styles jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (template_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template ON public.template_versions(template_id, version_number DESC);

ALTER TABLE public.templates
  DROP CONSTRAINT IF EXISTS templates_current_version_fk,
  ADD CONSTRAINT templates_current_version_fk FOREIGN KEY (current_version_id)
    REFERENCES public.template_versions(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE IF NOT EXISTS public.template_renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.templates(id) ON DELETE SET NULL,
  template_version_id uuid REFERENCES public.template_versions(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  output_format text NOT NULL CHECK (output_format IN ('pdf','html')),
  entity_type text,
  entity_id text,
  rendered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rendered_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'success',
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_template_renders_template ON public.template_renders(template_id, rendered_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_renders_client ON public.template_renders(client_id, rendered_at DESC);

-- 2) RLS POLICIES -------------------------------------------------------------

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_renders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_select" ON public.templates;
CREATE POLICY "templates_select" ON public.templates FOR SELECT
  USING (is_sample = true OR client_id = current_user_client_id() OR is_super_admin());

DROP POLICY IF EXISTS "templates_insert" ON public.templates;
CREATE POLICY "templates_insert" ON public.templates FOR INSERT
  WITH CHECK ((is_sample = false AND client_id = current_user_client_id()) OR is_super_admin());

DROP POLICY IF EXISTS "templates_update" ON public.templates;
CREATE POLICY "templates_update" ON public.templates FOR UPDATE
  USING ((is_sample = false AND client_id = current_user_client_id()) OR is_super_admin());

DROP POLICY IF EXISTS "templates_delete" ON public.templates;
CREATE POLICY "templates_delete" ON public.templates FOR DELETE
  USING ((is_sample = false AND client_id = current_user_client_id()) OR is_super_admin());

DROP POLICY IF EXISTS "template_versions_select" ON public.template_versions;
CREATE POLICY "template_versions_select" ON public.template_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.templates t WHERE t.id = template_id
    AND (t.is_sample = true OR t.client_id = current_user_client_id() OR is_super_admin())));

DROP POLICY IF EXISTS "template_versions_insert" ON public.template_versions;
CREATE POLICY "template_versions_insert" ON public.template_versions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.templates t WHERE t.id = template_id
    AND ((t.is_sample = false AND t.client_id = current_user_client_id()) OR is_super_admin())));

DROP POLICY IF EXISTS "template_renders_select" ON public.template_renders;
CREATE POLICY "template_renders_select" ON public.template_renders FOR SELECT
  USING (client_id = current_user_client_id() OR is_super_admin());

DROP POLICY IF EXISTS "template_renders_insert" ON public.template_renders;
CREATE POLICY "template_renders_insert" ON public.template_renders FOR INSERT
  WITH CHECK (client_id = current_user_client_id() OR is_super_admin() OR client_id IS NULL);

-- 3) SEED 6 SAMPLE TEMPLATES (3 invoice + 3 pickslip) -------------------------
-- Re-runnable: deletes existing samples first, then re-inserts.

DELETE FROM public.templates WHERE is_sample = true AND type IN ('invoice','pickslip');

DO $seed$
DECLARE
  v_tpl uuid;
  v_ver uuid;
BEGIN
  -- INVOICE: Classic
  INSERT INTO public.templates (is_sample, name, description, type)
  VALUES (true, 'Classic Invoice', 'Traditional invoice layout with company header and itemized table', 'invoice')
  RETURNING id INTO v_tpl;
  INSERT INTO public.template_versions (template_id, version_number, document, styles, change_note)
  VALUES (v_tpl, 1,
    '{"version":1,"page":{"size":"A4","orientation":"portrait","margins":{"top":40,"right":40,"bottom":40,"left":40}},"blocks":[
      {"id":"b1","type":"heading","props":{"text":"INVOICE","level":1,"align":"center"}},
      {"id":"b2","type":"text","props":{"text":"{{ store.name }} — {{ store.address }}","align":"center","color":"#666"}},
      {"id":"b3","type":"divider","props":{"color":"#000","thickness":2}},
      {"id":"b4","type":"columns","props":{"columns":[
        [{"id":"b5","type":"text","props":{"text":"Bill To:","bold":true}},{"id":"b6","type":"address_block","props":{"source":"billing"}}],
        [{"id":"b7","type":"text","props":{"text":"Invoice #{{ order.number }}","bold":true,"align":"right"}},{"id":"b8","type":"text","props":{"text":"Date: {{ order.date }}","align":"right"}}]
      ]}},
      {"id":"b9","type":"spacer","props":{"height":16}},
      {"id":"b10","type":"order_items_table","props":{"showImage":false,"showSku":true,"showQty":true,"showPrice":true,"showTotal":true,"showBin":false,"headerColor":"#1f2937"}},
      {"id":"b11","type":"totals_block","props":{"showSubtotal":true,"showShipping":true,"showTax":true,"showDiscount":true,"showTotal":true,"emphasize":true,"align":"right"}},
      {"id":"b12","type":"spacer","props":{"height":24}},
      {"id":"b13","type":"text","props":{"text":"Thank you for your business.","align":"center","italic":true,"color":"#666"}}
    ]}'::jsonb,
    '{"baseFontFamily":"Helvetica","baseFontSize":11,"primaryColor":"#1f2937","accentColor":"#3b82f6"}'::jsonb,
    'Initial seed')
  RETURNING id INTO v_ver;
  UPDATE public.templates SET current_version_id = v_ver WHERE id = v_tpl;

  -- INVOICE: Modern
  INSERT INTO public.templates (is_sample, name, description, type)
  VALUES (true, 'Modern Invoice', 'Clean modern layout with accent color and minimal borders', 'invoice')
  RETURNING id INTO v_tpl;
  INSERT INTO public.template_versions (template_id, version_number, document, styles, change_note)
  VALUES (v_tpl, 1,
    '{"version":1,"page":{"size":"A4","orientation":"portrait","margins":{"top":48,"right":48,"bottom":48,"left":48}},"blocks":[
      {"id":"a1","type":"columns","props":{"columns":[
        [{"id":"a2","type":"heading","props":{"text":"{{ store.name }}","level":2,"align":"left","color":"#3b82f6"}},{"id":"a3","type":"text","props":{"text":"{{ store.email }}","color":"#666","size":10}}],
        [{"id":"a4","type":"text","props":{"text":"INVOICE","bold":true,"align":"right","size":24,"color":"#3b82f6"}},{"id":"a5","type":"text","props":{"text":"#{{ order.number }}","align":"right","color":"#666"}}]
      ]}},
      {"id":"a6","type":"divider","props":{"color":"#3b82f6","thickness":3}},
      {"id":"a7","type":"spacer","props":{"height":20}},
      {"id":"a8","type":"columns","props":{"columns":[
        [{"id":"a9","type":"text","props":{"text":"BILL TO","bold":true,"size":9,"color":"#999"}},{"id":"a10","type":"address_block","props":{"source":"billing"}}],
        [{"id":"a11","type":"text","props":{"text":"DATE","bold":true,"size":9,"color":"#999"}},{"id":"a12","type":"text","props":{"text":"{{ order.date }}"}}]
      ]}},
      {"id":"a13","type":"spacer","props":{"height":20}},
      {"id":"a14","type":"order_items_table","props":{"showImage":true,"showSku":false,"showQty":true,"showPrice":true,"showTotal":true,"showBin":false,"headerColor":"#3b82f6"}},
      {"id":"a15","type":"totals_block","props":{"showSubtotal":true,"showShipping":true,"showTax":true,"showDiscount":true,"showTotal":true,"emphasize":true,"align":"right"}}
    ]}'::jsonb,
    '{"baseFontFamily":"Helvetica","baseFontSize":11,"primaryColor":"#3b82f6","accentColor":"#1f2937"}'::jsonb,
    'Initial seed')
  RETURNING id INTO v_ver;
  UPDATE public.templates SET current_version_id = v_ver WHERE id = v_tpl;

  -- INVOICE: Minimal
  INSERT INTO public.templates (is_sample, name, description, type)
  VALUES (true, 'Minimal Invoice', 'Stripped-down invoice with just the essentials', 'invoice')
  RETURNING id INTO v_tpl;
  INSERT INTO public.template_versions (template_id, version_number, document, styles, change_note)
  VALUES (v_tpl, 1,
    '{"version":1,"page":{"size":"A4","orientation":"portrait","margins":{"top":56,"right":56,"bottom":56,"left":56}},"blocks":[
      {"id":"m1","type":"text","props":{"text":"{{ store.name }}","bold":true,"size":14}},
      {"id":"m2","type":"text","props":{"text":"Invoice #{{ order.number }} • {{ order.date }}","color":"#666","size":10}},
      {"id":"m3","type":"spacer","props":{"height":24}},
      {"id":"m4","type":"address_block","props":{"source":"billing"}},
      {"id":"m5","type":"spacer","props":{"height":24}},
      {"id":"m6","type":"order_items_table","props":{"showImage":false,"showSku":false,"showQty":true,"showPrice":true,"showTotal":true,"showBin":false,"headerColor":"#000"}},
      {"id":"m7","type":"totals_block","props":{"showSubtotal":true,"showShipping":true,"showTax":false,"showDiscount":false,"showTotal":true,"emphasize":true,"align":"right"}}
    ]}'::jsonb,
    '{"baseFontFamily":"Helvetica","baseFontSize":11,"primaryColor":"#000","accentColor":"#000"}'::jsonb,
    'Initial seed')
  RETURNING id INTO v_ver;
  UPDATE public.templates SET current_version_id = v_ver WHERE id = v_tpl;

  -- PICKSLIP: Standard
  INSERT INTO public.templates (is_sample, name, description, type)
  VALUES (true, 'Standard Pick Slip', 'Warehouse pick slip with shipping address and item list', 'pickslip')
  RETURNING id INTO v_tpl;
  INSERT INTO public.template_versions (template_id, version_number, document, styles, change_note)
  VALUES (v_tpl, 1,
    '{"version":1,"page":{"size":"A4","orientation":"portrait","margins":{"top":40,"right":40,"bottom":40,"left":40}},"blocks":[
      {"id":"p1","type":"heading","props":{"text":"PICK SLIP","level":1,"align":"center"}},
      {"id":"p2","type":"text","props":{"text":"Order #{{ order.number }} • {{ order.date }}","align":"center","color":"#666"}},
      {"id":"p3","type":"divider","props":{"color":"#000","thickness":2}},
      {"id":"p4","type":"text","props":{"text":"SHIP TO:","bold":true}},
      {"id":"p5","type":"address_block","props":{"source":"shipping"}},
      {"id":"p6","type":"spacer","props":{"height":16}},
      {"id":"p7","type":"order_items_table","props":{"showImage":true,"showSku":true,"showQty":true,"showPrice":false,"showTotal":false,"showBin":true,"headerColor":"#1f2937"}},
      {"id":"p8","type":"spacer","props":{"height":24}},
      {"id":"p9","type":"signature_line","props":{"label":"Picked by","widthPercent":50}}
    ]}'::jsonb,
    '{"baseFontFamily":"Helvetica","baseFontSize":11,"primaryColor":"#1f2937","accentColor":"#000"}'::jsonb,
    'Initial seed')
  RETURNING id INTO v_ver;
  UPDATE public.templates SET current_version_id = v_ver WHERE id = v_tpl;

  -- PICKSLIP: Compact
  INSERT INTO public.templates (is_sample, name, description, type)
  VALUES (true, 'Compact Pick Slip', 'Half-page pick slip for small parcels', 'pickslip')
  RETURNING id INTO v_tpl;
  INSERT INTO public.template_versions (template_id, version_number, document, styles, change_note)
  VALUES (v_tpl, 1,
    '{"version":1,"page":{"size":"A4","orientation":"portrait","margins":{"top":24,"right":24,"bottom":24,"left":24}},"blocks":[
      {"id":"c1","type":"columns","props":{"columns":[
        [{"id":"c2","type":"text","props":{"text":"PICK","bold":true,"size":18}},{"id":"c3","type":"text","props":{"text":"#{{ order.number }}","size":12}}],
        [{"id":"c4","type":"barcode","props":{"value":"{{ order.number }}","format":"code128","width":150,"height":40}}]
      ]}},
      {"id":"c5","type":"divider","props":{"color":"#000","thickness":1}},
      {"id":"c6","type":"address_block","props":{"source":"shipping"}},
      {"id":"c7","type":"order_items_table","props":{"showImage":false,"showSku":true,"showQty":true,"showPrice":false,"showTotal":false,"showBin":true,"headerColor":"#000"}}
    ]}'::jsonb,
    '{"baseFontFamily":"Helvetica","baseFontSize":10,"primaryColor":"#000","accentColor":"#000"}'::jsonb,
    'Initial seed')
  RETURNING id INTO v_ver;
  UPDATE public.templates SET current_version_id = v_ver WHERE id = v_tpl;

  -- PICKSLIP: Detailed
  INSERT INTO public.templates (is_sample, name, description, type)
  VALUES (true, 'Detailed Pick Slip', 'Full pick slip with product images, bin locations and signatures', 'pickslip')
  RETURNING id INTO v_tpl;
  INSERT INTO public.template_versions (template_id, version_number, document, styles, change_note)
  VALUES (v_tpl, 1,
    '{"version":1,"page":{"size":"A4","orientation":"portrait","margins":{"top":40,"right":40,"bottom":40,"left":40}},"blocks":[
      {"id":"d1","type":"heading","props":{"text":"WAREHOUSE PICK SLIP","level":1,"align":"left"}},
      {"id":"d2","type":"columns","props":{"columns":[
        [{"id":"d3","type":"text","props":{"text":"Order #{{ order.number }}","bold":true}},{"id":"d4","type":"text","props":{"text":"Date: {{ order.date }}","size":10,"color":"#666"}}],
        [{"id":"d5","type":"qr_code","props":{"value":"{{ order.number }}","size":80}}]
      ]}},
      {"id":"d6","type":"divider","props":{"color":"#000","thickness":1}},
      {"id":"d7","type":"text","props":{"text":"SHIP TO:","bold":true,"size":10}},
      {"id":"d8","type":"address_block","props":{"source":"shipping"}},
      {"id":"d9","type":"spacer","props":{"height":16}},
      {"id":"d10","type":"order_items_table","props":{"showImage":true,"showSku":true,"showQty":true,"showPrice":false,"showTotal":false,"showBin":true,"headerColor":"#1f2937"}},
      {"id":"d11","type":"spacer","props":{"height":32}},
      {"id":"d12","type":"columns","props":{"columns":[
        [{"id":"d13","type":"signature_line","props":{"label":"Picked by","widthPercent":80}}],
        [{"id":"d14","type":"signature_line","props":{"label":"Checked by","widthPercent":80}}]
      ]}}
    ]}'::jsonb,
    '{"baseFontFamily":"Helvetica","baseFontSize":11,"primaryColor":"#1f2937","accentColor":"#3b82f6"}'::jsonb,
    'Initial seed')
  RETURNING id INTO v_ver;
  UPDATE public.templates SET current_version_id = v_ver WHERE id = v_tpl;

END $seed$;