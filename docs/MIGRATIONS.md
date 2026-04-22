# Supabase Migrations — Reliability Checklist

## Background

Several migrations in `supabase/migrations/` are 0 bytes. The `execute_sql_query` tool claims to auto-create migration files after DDL, but this sometimes silently fails. Result: schema changes reach the dev DB but never get committed as files → production deploys miss them → silent production bugs (e.g. "No orders yet" home page).

## Rules for the agent

Every time an agent runs `execute_sql_query` that changes schema (any `CREATE / ALTER / DROP` of function, table, view, policy, trigger, type), the agent must:

1. **Verify the migration file exists and is non-empty.** Immediately after the query:
   ```bash
   grep -l "<object_name>" supabase/migrations/*.sql
   ```
   If no file contains the object, write one manually with `create_file`. Dump the definition from the DB:
   ```sql
   SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = '<name>';
   -- or for tables: query information_schema
   ```
   Save under `supabase/migrations/YYYYMMDDHHMMSS_<slug>.sql`.

2. **Never trust auto-migration for DDL.** Treat auto-created files as a nice-to-have. Always author the `.sql` file yourself for anything beyond one-off data inserts.

3. **Leave a breadcrumb in the task file.** If a task involves schema changes, the checklist must include an explicit "migration file created and verified non-empty" item.

## Pre-deploy check (user side)

Before pushing to Vercel, run from the project root:

```bash
find supabase/migrations -name "*.sql" -size 0
```

Any hits = migrations that exist only as empty files. They will NOT run on production. Fix before deploy by re-capturing the SQL from the dev DB.

## Manual migration to production

Supabase Dashboard → SQL Editor → paste the full contents of the migration file → Run.

No Vercel redeploy needed for pure-DB fixes.

## Known broken migrations to audit

These files are 0 bytes and may correspond to objects missing from prod:

- `20260421235623_migration_24b13bd0.sql`
- `20260421235503_migration_6f8fe090.sql`
- `20260421194723_migration_4b932547.sql`
- `20260421134713_migration_af6a7eb4.sql`
- `20260420003019_migration_54663a90.sql`
- `20260419143145_migration_cec7a86e.sql`
- `20260419132816_migration_3d1c7031.sql`
- `20260419100921_migration_b0467772.sql`
- `20260419005124_migration_6bae789a.sql`
- `20260418100900_migration_b816b543.sql`

Next time a prod feature breaks with "not found" or silent failures, start here.