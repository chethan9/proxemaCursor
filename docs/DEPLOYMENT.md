# Deployment Guide

Safe-deploy workflow for WooSync. Read this before every production push.

## Environments

| Env | Domain | Supabase project | Purpose |
|---|---|---|---|
| Dev | localhost:3000 / softgen preview | `woosync-dev` | Daily development |
| Staging (future) | staging.tryapp.cc | `woosync-staging` | Pre-prod smoke tests |
| Production | tryapp.cc | `woosync-prod` | Customer data |

**Rule:** dev never points at the prod Supabase. Staging is optional today, mandatory once you have >5 paying clients.

## Required env vars (per environment)

Set these in Vercel → Project Settings → Environment Variables, scoped to the correct environment (Production / Preview / Development):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_APP_URL=https://tryapp.cc
```

Dev `.env.local` uses the same keys pointing at `woosync-dev` and `NEXT_PUBLIC_APP_URL` set to your softgen preview URL.

`NEXT_PUBLIC_APP_URL` drives webhook delivery URLs. Getting this wrong = webhooks go to the wrong domain. Double-check it on every environment.

## One-time: create production Supabase

1. supabase.com → New Project → name `woosync-prod`
2. Pick region close to your users (and close to Vercel region)
3. Copy URL, anon key, service_role key from Project Settings → API
4. Paste into Vercel (Production scope only)
5. Copy the Database connection string (Session mode, port 5432) from Settings → Database
6. Run migrations: see next section

## Running migrations

All schema changes live in `supabase/migrations/` as timestamped SQL files. The runner applies them in order and tracks what's been applied in a `schema_migrations` table.

```bash
# Apply all pending migrations to a target database
DATABASE_URL="postgresql://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres" npm run db:migrate
```

**The runner is idempotent** — safe to re-run. Already-applied migrations are skipped.

**On first run** against the new prod DB: it applies all 33+ migrations from scratch. Takes ~30 seconds.

**On every subsequent deploy** with schema changes: runs only the new ones.

### When to run migrations

Run the migration command **before** deploying code that depends on new columns/tables. Order:

1. Merge migration SQL to main
2. `npm run db:migrate` against prod (while old code still runs — migrations must be backward-compat, see below)
3. Vercel auto-deploys new code
4. Verify

## Expand-contract migration pattern

**Migrations must be backward-compatible for one deploy cycle.** Old code must keep working against the new schema.

❌ Never in one deploy:
```sql
ALTER TABLE orders DROP COLUMN old_field;
```
Running pods using `old_field` crash instantly.

✅ Safe multi-step rename:
```
Deploy 1: ALTER TABLE orders ADD COLUMN new_field TEXT;   (old code ignores it)
Deploy 2: Code writes to both old_field and new_field
Deploy 3: Backfill: UPDATE orders SET new_field = old_field WHERE new_field IS NULL;
Deploy 4: Code reads from new_field only, still writes both
Deploy 5 (weeks later): ALTER TABLE orders DROP COLUMN old_field;
```

Takes longer but zero downtime and fully reversible at every step.

## Pre-deploy checklist

Before merging to `main`:

- [ ] Feature tested locally against `woosync-dev`
- [ ] Migration added to `supabase/migrations/` (if schema change)
- [ ] Migration applied and tested on dev DB
- [ ] Staging smoke test passed (when staging exists)
- [ ] Webhook events still processing (check webhook_events table)
- [ ] API v1 consumers (Flutter app) verified unaffected
- [ ] Rollback plan understood (Vercel instant rollback + any DB reverse migration)
- [ ] Deploy during low-traffic window (not Friday evening)

## Deploy procedure

1. **Run migrations first** — `npm run db:migrate` with prod `DATABASE_URL`
2. **Merge to main** — Vercel auto-deploys
3. **Watch logs for 15 min** — Vercel dashboard + Supabase → Logs Explorer
4. **Verify webhooks firing** — check `webhook_events.created_at` from the last 10 min
5. **Verify sync runs clean** — `sync_runs` table, status = completed

## Rollback

**Code rollback (instant, always safe):**
Vercel → Deployments → prior deploy → Promote to Production. ~30 seconds.

**DB rollback (rare, manual):**
1. Identify the migration to revert — `supabase/migrations/` filename
2. Write and run the reverse SQL via Supabase dashboard SQL editor
3. Remove the row from `schema_migrations` so the runner won't skip it
4. Because migrations are expand-contract, rollback should rarely touch data

## Post-deploy monitoring

- **Vercel logs** — runtime errors in API routes
- **Supabase logs** — slow queries, RLS denials, connection pool
- **`webhook_events` table** — failed_count trending up = webhook handler bug
- **`sync_runs` table** — failed status spike = WooCommerce integration bug

## Disaster recovery

**Webhook URLs broken (domain changed, keys rotated):**
`POST /api/webhooks/repair-all` with body `{}` → iterates every active webhook, PUTs the new delivery URL to WooCommerce. Protected by service_role.

**Data corruption / bad deploy that touched data:**
- Supabase Pro plan includes Point-in-Time Recovery ($25/mo) — rewind DB to any second in last 7 days. Enable before going live with paying clients.
- Free tier has daily backups, restore via dashboard (slower, loses up to 24h).

**Bad migration applied to prod:**
- Stop deploys immediately
- Write reverse migration
- Apply via Supabase SQL editor (not the runner)
- Remove entry from `schema_migrations`

## What NOT to do

- Edit customer data directly via Supabase dashboard to "fix" a bug — creates invisible drift
- Hotfix prod by skipping staging
- Drop columns in the same deploy that stops using them (see expand-contract above)
- Mix a migration PR with a feature PR — keep them separate for easy rollback
- Run destructive SQL (`DROP`, `DELETE`, `TRUNCATE`, `UPDATE` without `WHERE`) without a fresh backup

## Future improvements (deferred)

- **Staging environment** — second Supabase project + staging.tryapp.cc Vercel env
- **Supabase PITR** — $25/mo, non-negotiable once you have paying customers
- **Feature flags column** on `clients` table — gradual rollout per client, instant kill switch
- **CI-based migration runs** — GitHub Action that runs `npm run db:migrate` before deploy

## Related

- Webhook URL logic: `src/lib/app-url.ts`
- Fleet webhook repair: `src/pages/api/webhooks/repair-all.ts`
- Migration runner: `scripts/migrate.mjs`