INSERT INTO storage.buckets (id, name, public)
VALUES ('bulk-invoices', 'bulk-invoices', false)
ON CONFLICT (id) DO NOTHING;