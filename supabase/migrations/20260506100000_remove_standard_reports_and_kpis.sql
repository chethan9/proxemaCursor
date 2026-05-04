-- Remove Standard Reports catalog and native KPI RPC (Metabase / Reports tab stack retired).

drop table if exists public.standard_reports cascade;

drop function if exists public.store_reports_kpis(text, integer) cascade;

notify pgrst, 'reload schema';
