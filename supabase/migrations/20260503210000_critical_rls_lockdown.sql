-- Critical RLS lockdown: enable profiles RLS, drop permissive policies, replace with tenant-scoped policies.
-- Revert (emergency): see commented block at end of file.

-- ---------------------------------------------------------------------------
-- 1. profiles: enable RLS and replace open SELECT
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_self_or_client" on public.profiles;
create policy "profiles_select_self_or_client" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_super_admin()
    or (client_id is not null and client_id = public.current_user_client_id())
  );

drop policy if exists "p_select" on public.profiles;

alter table public.profiles enable row level security;

-- ---------------------------------------------------------------------------
-- 2. api_tokens
-- ---------------------------------------------------------------------------
drop policy if exists "api_tokens_read" on public.api_tokens;
drop policy if exists "api_tokens_write" on public.api_tokens;
drop policy if exists "api_tokens_update" on public.api_tokens;
drop policy if exists "api_tokens_delete" on public.api_tokens;

create policy "api_tokens_select_own" on public.api_tokens
  for select to authenticated
  using (client_id = public.current_user_client_id() or public.is_super_admin());

create policy "api_tokens_insert_own" on public.api_tokens
  for insert to authenticated
  with check (client_id = public.current_user_client_id() or public.is_super_admin());

create policy "api_tokens_update_own" on public.api_tokens
  for update to authenticated
  using (client_id = public.current_user_client_id() or public.is_super_admin())
  with check (client_id = public.current_user_client_id() or public.is_super_admin());

create policy "api_tokens_delete_own" on public.api_tokens
  for delete to authenticated
  using (client_id = public.current_user_client_id() or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 3. api_keys & api_call_logs
-- ---------------------------------------------------------------------------
drop policy if exists "anon_all_api_keys" on public.api_keys;

create policy "api_keys_select_own" on public.api_keys
  for select to authenticated
  using (client_id = public.current_user_client_id() or public.is_super_admin());

create policy "api_keys_insert_own" on public.api_keys
  for insert to authenticated
  with check (client_id = public.current_user_client_id() or public.is_super_admin());

create policy "api_keys_update_own" on public.api_keys
  for update to authenticated
  using (client_id = public.current_user_client_id() or public.is_super_admin())
  with check (client_id = public.current_user_client_id() or public.is_super_admin());

create policy "api_keys_delete_own" on public.api_keys
  for delete to authenticated
  using (client_id = public.current_user_client_id() or public.is_super_admin());

drop policy if exists "anon_all_api_logs" on public.api_call_logs;

create policy "api_call_logs_select_own" on public.api_call_logs
  for select to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.api_keys k
      where k.id = api_call_logs.api_key_id
        and k.client_id is not null
        and k.client_id = public.current_user_client_id()
    )
  );

create policy "api_call_logs_insert_own" on public.api_call_logs
  for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.api_keys k
      where k.id = api_call_logs.api_key_id
        and k.client_id is not null
        and k.client_id = public.current_user_client_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. api_request_logs
-- ---------------------------------------------------------------------------
drop policy if exists "api_logs_all" on public.api_request_logs;

create policy "api_request_logs_select_own" on public.api_request_logs
  for select to authenticated
  using (client_id = public.current_user_client_id() or public.is_super_admin());

-- Inserts from API auth layer use service_role (bypass RLS).

-- ---------------------------------------------------------------------------
-- 5. sync_runs — drop shadow public_* policies (scoped policies remain)
-- ---------------------------------------------------------------------------
drop policy if exists "public_read_sync_runs" on public.sync_runs;
drop policy if exists "public_insert_sync_runs" on public.sync_runs;
drop policy if exists "public_update_sync_runs" on public.sync_runs;
drop policy if exists "public_delete_sync_runs" on public.sync_runs;

-- ---------------------------------------------------------------------------
-- 6. cron_logs — drop open insert/update; service_role only for writes
-- ---------------------------------------------------------------------------
drop policy if exists "public_insert_cron_logs" on public.cron_logs;
drop policy if exists "public_update_cron_logs" on public.cron_logs;

create policy "cron_logs_insert_service" on public.cron_logs
  for insert to service_role
  with check (true);

create policy "cron_logs_update_service" on public.cron_logs
  for update to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- 7. sync_benchmarks
-- ---------------------------------------------------------------------------
drop policy if exists "bench_select" on public.sync_benchmarks;
drop policy if exists "bench_insert" on public.sync_benchmarks;

create policy "bench_select_scoped" on public.sync_benchmarks
  for select to authenticated
  using (public.user_can_access_store(store_id) or public.is_super_admin());

create policy "bench_insert_scoped" on public.sync_benchmarks
  for insert to authenticated
  with check (public.user_can_access_store(store_id) or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- 8. webhook_test_results
-- ---------------------------------------------------------------------------
drop policy if exists "wtr_read" on public.webhook_test_results;
drop policy if exists "wtr_write" on public.webhook_test_results;

create policy "wtr_select_scoped" on public.webhook_test_results
  for select to authenticated
  using (
    public.is_super_admin()
    or (store_id is not null and public.user_can_access_store(store_id))
  );

create policy "wtr_insert_scoped" on public.webhook_test_results
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (store_id is not null and public.user_can_access_store(store_id))
  );

create policy "wtr_update_scoped" on public.webhook_test_results
  for update to authenticated
  using (
    public.is_super_admin()
    or (store_id is not null and public.user_can_access_store(store_id))
  )
  with check (
    public.is_super_admin()
    or (store_id is not null and public.user_can_access_store(store_id))
  );

-- ---------------------------------------------------------------------------
-- 9. store_aspect_sync_state — restrict to service_role explicitly
-- ---------------------------------------------------------------------------
drop policy if exists "service_role_all" on public.store_aspect_sync_state;

create policy "store_aspect_sync_state_service_role" on public.store_aspect_sync_state
  for all to service_role
  using (true)
  with check (true);

notify pgrst, 'reload schema';

-- EMERGENCY REVERT (run manually if needed):
-- alter table public.profiles disable row level security;
-- drop policy if exists profiles_select_self_or_client on public.profiles;
-- create policy p_select on public.profiles for select to authenticated using (true);
-- ... restore dropped permissive policies from historical migrations if required.
