-- Add a global starter sample for the new "Main Invoice" layout.
-- We only create the template row here; when a user customizes/forks it,
-- the app falls back to blankInvoiceHtml() if the sample has no version HTML.
INSERT INTO public.templates (
  is_sample,
  client_id,
  name,
  description,
  type,
  is_default_for_type
)
SELECT
  true,
  NULL,
  'Main Invoice',
  'Reference invoice layout matching the Minimal Store design with precise alignment.',
  'invoice',
  false
WHERE NOT EXISTS (
  SELECT 1
  FROM public.templates t
  WHERE t.is_sample = true
    AND t.type = 'invoice'
    AND lower(t.name) = lower('Main Invoice')
);
