---
title: Live Supabase reconciliation runbook
status: done
priority: urgent
type: chore
tags: [supabase, migration, ops, live]
created_by: agent
created_at: 2026-04-25T18:35:00Z
position: 196
---

## Notes

**Goal:** Bring Live Supabase (own project) to schema parity with Dev Supabase (softgen). Sync was already unblocked by adding `stores.last_full_sync_at`. This runbook closes the remaining drift and emits a single consolidated migration committed to `supabase/migrations/` so Test and future deploys stay aligned.

**Source of truth:** Dev Supabase project (softgen).
**Target:** Live (own) Supabase project.
**Tooling:** `<execute_sql_query>` against Live for schema reads/writes. To extract function bodies / table DDL from Dev, ask the user to run `pg_get_functiondef(oid)` / `pg_dump --schema-only` on Dev and paste the output — the agent does NOT have direct access to Dev DB, only to Live.

**Confirmed differences to reconcile (from user diff):**
1. Table `payment_gateway_settings` — entire table missing on Live (this is why the user's `CREATE POLICY auth_read_gateway_settings` failed; create table first, then policy).
2. Column `plans.is_default_trial boolean` — missing on Live.
3. Function `touch_payment_gateway_settings()` — missing on Live (likely a trigger function for the new table's `updated_at`).
4. Function `unmark_other_default_trials()` — missing on Live (likely a trigger that enforces single default trial in `plans`).
5. Function `get_site_home_stats(p_store_id uuid, p_tz text, p_currency text)` — Live has 2-arg version, Dev has 3-arg. App likely calls 3-arg now.
6. Storage policies on `storage.objects` — Live has split-per-bucket policies; Dev has combined `auth_upload/auth_update/auth_delete/public_read` covering buckets `public-assets`, `site-logos`, `site-screenshots`. Site screenshot capture during sync depends on these.

**Explicitly NOT replicated (intentionally diverging):**
- Dev's `public_*` policies on `sync_runs` (read/insert/update/delete) — security risk, do not copy to Live.
- Dev's duplicate `get_site_home_stats(uuid, text)` 2-arg overload — drop after 3-arg version is in place to avoid PostgREST ambiguity.
- `roles.authenticated_read_roles` (extra in Own) — harmless, keep.
- `uuid_generate_v4()` schema qualification differences — cosmetic, no action.

**Output:** A single SQL file `supabase/migrations/YYYYMMDDHHMMSS_live_reconciliation.sql` containing all changes applied, committed to git so it's part of normal migration flow.

**Workflow:**
1. Run `<get_database_schema>` to confirm Live's current state.
2. Ask user to paste outputs from Dev for the 3 missing function bodies + the `payment_gateway_settings` CREATE TABLE DDL.
3. Apply each step via `<execute_sql_query>` to Live, verifying after each.
4. Re-diff and report parity.
5. Author the consolidated migration file.

## Checklist

- [ ] Run `<get_database_schema>` on Live to capture baseline; confirm `payment_gateway_settings` absent, `plans.is_default_trial` absent, the 3 functions absent.
- [ ] Ask user to run on Dev and paste back: full DDL for `payment_gateway_settings` (columns, indexes, FKs, RLS state) and bodies of `touch_payment_gateway_settings`, `unmark_other_default_trials`, `get_site_home_stats(uuid, text, text)` via `pg_get_functiondef`.
- [ ] Create `payment_gateway_settings` table on Live with exact DDL from Dev; enable RLS.
- [ ] Add RLS policy `auth_read_gateway_settings` on the new table (the query that originally failed for the user — will succeed once table exists).
- [ ] Add column `plans.is_default_trial boolean DEFAULT false NOT NULL`.
- [ ] Create function `touch_payment_gateway_settings()` and attach as `BEFORE UPDATE` trigger on `payment_gateway_settings` for `updated_at` maintenance.
- [ ] Create function `unmark_other_default_trials()` and attach as trigger on `plans` so only one row can have `is_default_trial = true`.
- [ ] Replace `get_site_home_stats` with the 3-arg version `(p_store_id uuid, p_tz text, p_currency text)`; drop any leftover 2-arg overload on Live to prevent PostgREST resolution ambiguity.
- [ ] Storage policies on `storage.objects`: drop Live's split-per-bucket auth policies for the three managed buckets; create unified `auth_upload`, `auth_update`, `auth_delete`, `public_read` scoped to `bucket_id IN ('public-assets','site-logos','site-screenshots')` to match Dev.
- [ ] Re-run schema diff queries (functions, policies, columns) on Live and confirm parity with Dev for the items above.
- [ ] Smoke-test on Live: load site home page (uses 3-arg `get_site_home_stats`), upload a site logo (storage policies), trigger a sync (already verified working), open the pricing/plans page (uses `is_default_trial`).
- [ ] Author consolidated migration file `supabase/migrations/{timestamp}_live_reconciliation.sql` containing every statement applied above (idempotent: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` before re-create) so Test and future Live deploys converge automatically.
- [ ] Update `docs/MIGRATIONS.md` with a short note: "Live was hand-reconciled on {date} via `{timestamp}_live_reconciliation.sql`. Going forward, all schema changes must land as migration files in git before any environment receives them."

## Acceptance

- Live Supabase has `payment_gateway_settings` table, `plans.is_default_trial` column, and all 3 functions matching Dev signatures.
- Storage uploads to `public-assets` / `site-logos` / `site-screenshots` succeed on Live for authenticated users; public reads succeed for anon.
- A new sync run on a Live site completes end-to-end with no `42703` / `42883` / `42501` errors in `sync_runs.error_message` or Postgres logs.
- `supabase/migrations/{timestamp}_live_reconciliation.sql` committed and re-runnable safely against any environment.