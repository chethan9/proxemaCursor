CREATE TABLE IF NOT EXISTS public.sync_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  aspect text NOT NULL,
  record_count integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 0,
  is_initial boolean NOT NULL DEFAULT false,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sync_benchmarks_store ON public.sync_benchmarks(store_id);
CREATE INDEX IF NOT EXISTS idx_sync_benchmarks_aspect ON public.sync_benchmarks(aspect);
ALTER TABLE public.sync_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bench_select" ON public.sync_benchmarks FOR SELECT USING (true);
CREATE POLICY "bench_insert" ON public.sync_benchmarks FOR INSERT WITH CHECK (true);