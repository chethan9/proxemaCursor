ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS orders_history_from timestamptz DEFAULT (NOW() - INTERVAL '3 months') NOT NULL;

UPDATE public.stores
SET orders_history_from = COALESCE(orders_history_from, NOW() - INTERVAL '3 months')
WHERE orders_history_from IS NULL;

COMMENT ON COLUMN public.stores.orders_history_from IS
  'Cutoff date for initial / full sync of orders and customers. Records older than this are not fetched. Adjust via Site Settings to backfill more history.';