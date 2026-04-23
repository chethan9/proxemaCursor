---
title: Audit and backfill empty migration files
status: todo
priority: high
type: chore
tags: [database, migrations, deployment]
created_by: agent
created_at: 2026-04-23T13:25:00Z
position: 168
---

## Notes

Context: `supabase/migrations/` currently contains ~30+ zero-byte migration files. These are stubs created by `execute_sql_query` calls during development where the SQL ran against the dev DB but was never written into the migration file on disk.

Impact: `npm run db:migrate` silently skips empty files, so prod (or any fresh environment provisioned via the migration runner) ends up missing columns, policies, or indexes that exist on dev. This caused the `menu_configs` schema drift today (`id`, `scope`, `site_id` columns existed on dev but not in any migration, which made fresh `prod_schema.sql` imports crash the menu system).

Goal: make the migration files an honest record of dev DB state, so `npm run db:migrate` against a fresh prod DB produces the same schema as `prod_schema.sql`.

Approach: diff the schema implied by non-empty migration files against live dev schema, identify every empty migration file, classify each as (a) truly empty/obsolete → delete, or (b) represents real DDL → backfill with the SQL needed to reproduce that change. Use `scripts/dump-full.mjs` output as the reference for "what should be there".

Files involved: `supabase/migrations/*.sql`, `scripts/migrate.mjs`, `scripts/build-prod-schema.mjs`, `docs/MIGRATIONS.md`.

## Checklist

- [ ] List every zero-byte file in `supabase/migrations/` and group by date cluster to identify related batches
- [ ] For each empty file, determine what DDL it was supposed to contain by diffing against `supabase/prod_full_dump.sql` and the previous non-empty migration
- [ ] Backfill each empty file with the actual SQL (idempotent: `IF NOT EXISTS`, `DROP ... IF EXISTS` before `CREATE`)
- [ ] Delete any empty files that represent pure no-ops or reverted changes
- [ ] Run `node scripts/migrate.mjs` against a throwaway/reset dev branch to verify the full chain applies cleanly from scratch
- [ ] Rebuild `supabase/prod_schema.sql` via `node scripts/build-prod-schema.mjs` and confirm it matches the dev DB output
- [ ] Update `docs/MIGRATIONS.md` with the root cause and a "don't leave empty migration files" rule for future `execute_sql_query` calls

## Acceptance

- A fresh Supabase DB populated by running all files in `supabase/migrations/` in order produces the same schema as the current dev DB (verify by column/index/policy diff).
- No zero-byte files remain in `supabase/migrations/`.
- `docs/MIGRATIONS.md` explains how to avoid regenerating this problem.