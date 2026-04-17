-- Fix sync_runs aspect check to include 'tags'
ALTER TABLE sync_runs DROP CONSTRAINT IF EXISTS sync_runs_aspect_check;
ALTER TABLE sync_runs ADD CONSTRAINT sync_runs_aspect_check CHECK (aspect IN ('products', 'variations', 'categories', 'orders', 'customers', 'coupons', 'tags', 'all'));