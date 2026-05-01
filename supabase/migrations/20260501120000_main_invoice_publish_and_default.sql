-- Ensure platform "Main Invoice" sample has a published version (fixes bulk print / PDF render).
-- Prefer Main Invoice as is_default_for_type only when no invoice template is already marked default.

DO $$
DECLARE
  tpl_id uuid;
  ver_id uuid;
  html_doc text := '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Invoice {{order.invoice_number}}</title><style>@page{size:A4;margin:14mm}body{font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#111;margin:0}</style></head><body><h1 style="font-size:22px;margin:0 0 12px">Invoice</h1><p><strong>{{store.name}}</strong></p><p>Invoice #{{order.invoice_number}} · {{date order.date_iso "long"}}</p><table width="100%" style="border-collapse:collapse;margin-top:16px"><thead><tr style="background:#111;color:#fff"><th style="text-align:left;padding:8px">Product</th><th style="text-align:right;padding:8px">Qty</th><th style="text-align:right;padding:8px">Price</th></tr></thead><tbody>{{#each items}}<tr style="border-bottom:1px solid #e5e7eb"><td style="padding:8px">{{name}}</td><td style="text-align:right;padding:8px">{{quantity}}</td><td style="text-align:right;padding:8px">{{currency price ../order.currency}}</td></tr>{{/each}}</tbody></table><p style="margin-top:16px"><strong>Total:</strong> {{currency totals.total order.currency}}</p></body></html>';
BEGIN
  SELECT t.id INTO tpl_id
  FROM public.templates t
  WHERE t.is_sample = true
    AND t.type = 'invoice'
    AND lower(trim(t.name)) = lower('Main Invoice')
  LIMIT 1;

  IF tpl_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.templates t
    WHERE t.id = tpl_id AND t.current_version_id IS NOT NULL
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.template_versions v WHERE v.template_id = tpl_id) THEN
    SELECT v.id INTO ver_id
    FROM public.template_versions v
    WHERE v.template_id = tpl_id
    ORDER BY v.version_number DESC
    LIMIT 1;
    UPDATE public.templates
    SET current_version_id = ver_id, updated_at = now()
    WHERE id = tpl_id;
    RETURN;
  END IF;

  INSERT INTO public.template_versions (template_id, version_number, document, styles)
  VALUES (
    tpl_id,
    1,
    jsonb_build_object('html', html_doc),
    '{}'::jsonb
  )
  RETURNING id INTO ver_id;

  UPDATE public.templates
  SET current_version_id = ver_id,
      updated_at = now()
  WHERE id = tpl_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.templates WHERE type = 'invoice' AND is_default_for_type = true
  ) THEN
    UPDATE public.templates
    SET is_default_for_type = false
    WHERE type = 'invoice' AND is_sample = true AND id <> tpl_id;

    UPDATE public.templates
    SET is_default_for_type = true, updated_at = now()
    WHERE id = tpl_id;
  END IF;
END $$;
