-- PostgREST exposes RPCs to roles that can EXECUTE; grant authenticated so schema cache / API resolve reliably.
-- (service_role already used by Next.js admin client; authenticated avoids "function not in schema cache" in some setups.)

grant execute on function public.store_reports_kpis(text, integer) to authenticated;

notify pgrst, 'reload schema';
