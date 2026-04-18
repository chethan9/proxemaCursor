---
title: Supabase dev/prod split + migration runner
status: todo
priority: high
type: chore
tags: [deployment, database]
created_by: agent
created_at: 2026-04-18
position: 48
---

## Notes
Currently one Supabase project serves both dev and production. Before going live, split into two so dev experiments can never touch customer data.

Setup (user does manually, one time):
1. Create new Supabase project named `woosync-prod` via supabase.com dashboard
2. Copy URL + anon key + service_role key
3. Set in Vercel env vars (production scope only):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL=https://tryapp.cc`
4. Keep dev .env.local pointing to existing (now-dev) Supabase

Migration runner:
- Script: `scripts/migrate-prod.ts` (or shell) — reads all files in supabase/migrations/ in filename order, runs each against target Supabase via connection string arg
- Usage: `DATABASE_URL=<prod-pooler-url> npm run db:migrate:prod`
- Uses pg client or supabase CLI under the hood
- Idempotent: tracks applied migrations in a `schema_migrations` table, skips already-applied

Documentation: add to docs/DEPLOYMENT.md (task-49).

## Checklist
- [ ] Create scripts/migrate.sh or scripts/migrate.ts reading supabase/migrations/ in order
- [ ] Add npm script: "db:migrate": "node scripts/migrate.js" accepting DATABASE_URL env
- [ ] Script creates schema_migrations table on first run, records each applied migration by filename
- [ ] Script skips migrations already in schema_migrations
- [ ] Script fails fast on any migration error (no partial state)
- [ ] Test locally against throwaway Supabase project to verify all 33+ migrations apply clean
- [ ] Document setup steps in docs/DEPLOYMENT.md (env vars to set in Vercel, command to run)
- [ ] check_for_errors