CREATE TABLE public.bulk_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  total integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  succeeded integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bulk_jobs_status_check CHECK (status IN ('pending','running','completed','failed','cancelled')),
  CONSTRAINT bulk_jobs_job_type_check CHECK (job_type IN (
    'update_order_status','delete_orders',
    'update_product_price','update_product_stock','update_product_status','assign_product_categories','delete_products'
  ))
);

CREATE INDEX idx_bulk_jobs_status_created ON public.bulk_jobs (status, created_at);
CREATE INDEX idx_bulk_jobs_store_created ON public.bulk_jobs (store_id, created_at DESC);
CREATE INDEX idx_bulk_jobs_user ON public.bulk_jobs (user_id, created_at DESC);

ALTER TABLE public.bulk_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY bulk_jobs_select_scoped ON public.bulk_jobs FOR SELECT USING (user_can_access_store(store_id));
CREATE POLICY bulk_jobs_insert_scoped ON public.bulk_jobs FOR INSERT WITH CHECK (user_can_access_store(store_id));
CREATE POLICY bulk_jobs_update_scoped ON public.bulk_jobs FOR UPDATE USING (user_can_access_store(store_id));
CREATE POLICY bulk_jobs_delete_scoped ON public.bulk_jobs FOR DELETE USING (user_can_access_store(store_id));