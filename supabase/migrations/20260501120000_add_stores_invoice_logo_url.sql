-- Optional logo used on printed/PDF invoices when set; falls back to logo_url in template context.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS invoice_logo_url text;

COMMENT ON COLUMN public.stores.invoice_logo_url IS 'Public URL for invoice-specific branding; when null, invoice templates use logo_url.';
