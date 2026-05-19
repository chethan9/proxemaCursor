# Deployment Guide

Safe-deploy workflow for Proxima Cursor. Read this before every production push.

## Environments

Canonical Supabase refs for this codebase live in **`supabase/current-project.json`** (dashboard URLs live there too).

| Env | Domain | Supabase project | Purpose |
|---|---|---|---|
| Dev | localhost:3000 / Vercel preview | dev DB of your choice | Daily development |
| Staging (future) | (optional) | separate Supabase project | Pre-prod smoke tests |
| Production | e.g. `proximacursor.vercel.app` | **`fyqvmbrgyncthksbgrrr`** (`woosync-live-prod`) | Live customer data |

**Rule:** dev never points at the prod Supabase. Staging is optional today, mandatory once you have >5 paying clients.

**Stale snapshot:** `supabase/prod_full_dump.sql` embeds an older project ref (`zhsmlfdmtlzyxvioppex`). Do **not** treat that file as today’s production database identity — use `current-project.json` and Vercel env vars.

## Required env vars (per environment)

Set these in Vercel → Project Settings → Environment Variables, scoped to the correct environment (Production / Preview / Development):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_APP_URL=https://proximacursor.vercel.app
```

Dev `.env.local` uses the same keys pointing at your dev Supabase project and `NEXT_PUBLIC_APP_URL` set to your preview URL (e.g. Vercel preview hostname).

`NEXT_PUBLIC_APP_URL` drives webhook delivery URLs. Getting this wrong = webhooks go to the wrong domain. Double-check it on every environment.

### API rate limiting (optional, recommended for production)

Edge middleware rate-limits `/api/*` when Upstash Redis credentials are present (anonymous vs Bearer tiers). Cron routes, `/api/billing/webhooks/*`, `/api/webhooks/*`, `/api/build-info`, `/api/i18n/*`, and `/api/dev/*` are excluded — see [`src/lib/api-rate-limit-config.ts`](../src/lib/api-rate-limit-config.ts).

| Variable | Notes |
|---|---|
| `UPSTASH_REDIS_REST_URL` | From [Upstash](https://console.upstash.com/) Redis REST API. |
| `UPSTASH_REDIS_REST_TOKEN` | Pair with the URL above. |

If these are unset, middleware skips limiting (safe for local dev). Same Redis is reused for assistant chat limits when configured.

### WooCommerce sync tuning (optional)

Large catalogs (for example ~50k orders, ~5k products, ~25k customers) finish via **many resumable chunks** plus cron resume; defaults favor **low parallel load** on the store’s WordPress host.

| Variable | Default | Effect |
|---|---|---|
| `WOO_SYNC_PAGE_CONCURRENCY` | `2` (max `8`) | Parallel WC REST **page** requests per chunk for products, orders, customers, coupons. |
| `WOO_SYNC_MAX_PAGES_PER_CHUNK` | `12` (range `5`–`20`) | Max WC pages per aspect per serverless invocation (`PER_PAGE` is 100). Higher = fewer cron round-trips but longer runs and more Woo load. |

Taxonomy aspects (categories, tags, brands) use slightly higher parallelism than heavy aspects when using defaults. Failed pages are **retried at lower concurrency** inside `fetchPagesChunked` before the chunk aborts (weak shared hosting).

### Cloudflare product image mirroring (optional)

| Item | Notes |
|---|---|
| `CRON_SECRET` | Must match Vercel **Cron** auth so `/api/cron/*` returns 200 in production. |
| Scheduled job | `vercel.json` → `/api/cron/mirror-product-images-pipeline` every **10 minutes** (repair pending/failed + catalog backfill cursor). No open browser required. |
| `CF_MIRROR_REPAIR_BATCH` | Default 50 (max 250) pending/failed rows per run. |
| `CF_BACKFILL_PRODUCT_BATCH` | Default 30 products per backfill step (max 80). |
| `CF_MIRROR_MASTER_MAX_EDGE_PX` | Longest edge for master before upload (default 2048). |
| Cloudflare **thumb** variant | Size it to ~**384px** max width in the Cloudflare Images dashboard so delivery matches the product grid; the app stores `thumb` / `card` / `edit` / `zoom` variant URLs. See `src/lib/cloudflare-product-image-sizes.ts`. |

Legacy endpoints `/api/cron/mirror-product-images` and `/api/cron/mirror-product-images-backfill` remain for manual use but are no longer on the default Vercel schedule.

## Domain or hostname changes (do not skip Supabase)

Whenever production’s canonical URL changes — Vercel project rename, default `*.vercel.app` hostname, or custom domain add/remove — run this checklist in order:

1. **Vercel → Environment Variables (Production):** set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS origin (example: `https://proximacursor.vercel.app`). Trigger a production redeploy so the new value is baked into the build.

2. **Vercel → Domains:** ensure the hostname is attached to the correct project.

3. **Supabase Dashboard → Authentication → URL Configuration** (the Supabase project whose URL/keys you use in Vercel):
   - **Site URL:** same canonical origin as step 1.
   - **Redirect URLs:** add a wildcard for that host, e.g. `https://proximacursor.vercel.app/**`. Keep `http://localhost:3000/**` for local development. If this step is missed, users see Supabase errors such as redirect URL not allowed for login, signup, password reset, and email confirmation links.

4. **Webhooks:** if store webhooks still point at an old base URL, call `POST /api/webhooks/repair-all` (service role) or follow your webhook refresh procedure after `NEXT_PUBLIC_APP_URL` is correct.

## One-time: create production Supabase

If you are **not** reusing the existing project, create one in the dashboard. Otherwise open **`supabase/current-project.json`** for today’s production ref (`fyqvmbrgyncthksbgrrr`, name `woosync-live-prod`) and its dashboard links.

1. supabase.com → New Project → pick a name (this repo’s production DB is already **`woosync-live-prod`**).
2. Pick region close to your users (and close to Vercel region).
3. Copy URL, anon key, service_role key from Project Settings → API.
4. Paste into Vercel (Production scope only).
5. Copy the Database connection string (Session mode, port 5432) from Settings → Database (same host pattern as `db.<project-ref>.supabase.co`).
6. Run migrations: see next section.

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

## i18n: machine-translating non-English locales

English JSON in `public/locales/en/*.json` is the canonical source. Arabic JSON
in `public/locales/ar/*.json` is curated by hand. The other 8 locales (es, fr,
de, pt, hi, zh, ja, ru) live in the Supabase `translations` table and are
seeded by an LLM-driven script with `needs_review = true`, then proofread in
the admin UI at `/admin/languages/<code>`.

```bash
# Preview without API calls
npm run i18n:translate:dry -- --locales fr,de --namespaces common,auth

# Real run (writes to Supabase)
OPENAI_API_KEY=sk-...                                \
SUPABASE_URL=https://fyqvmbrgyncthksbgrrr.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ...                      \
npm run i18n:translate

# Re-translate existing rows
OPENAI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npm run i18n:translate -- --force --locales fr
```

Behavior:

- Reads `public/locales/en/*.json`, flattens to dot-keys, batches of 30.
- Calls OpenAI (`gpt-4o-mini` by default) with strict instructions to preserve
  `{{placeholders}}` and inline HTML tags.
- Upserts into `translations` keyed on `(locale, namespace, key)` with
  `needs_review = true`.
- Skips keys already present in the DB unless `--force` is passed.
- Writes a `_translation_run_<ts>.json` summary at the repo root.

## Related

- Webhook URL logic: `src/lib/app-url.ts`
- Fleet webhook repair: `src/pages/api/webhooks/repair-all.ts`
- Migration runner: `scripts/migrate.mjs`
- i18n translation pipeline: `scripts/translate-i18n.mjs`