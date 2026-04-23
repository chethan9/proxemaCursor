---
title: Production database reset
status: todo
priority: urgent
type: chore
tags: [database, supabase, reset]
created_by: agent
created_at: 2026-04-23T18:55:00Z
position: 173
---

## Notes

Production Supabase project `dhttgkwttmqxacixhmfg` is in a broken state — RLS policies call `is_super_admin()` correctly, profile row has role=super_admin + is_active=true, IDs match between `auth.users` and `profiles`, yet authenticated requests return 403 `permission denied`. Debug loop exhausted. User chose to nuke and restart.

**Goal:** fresh, consistent production DB reproducible from migration files in `supabase/migrations/` with seeded roles + user's super_admin profile.

**Approach:**
1. Generate a single reset migration that drops everything in the `public` schema (tables, functions, triggers, policies, types) except Supabase internals.
2. Re-apply the full migration history (all files in `supabase/migrations/` chronologically). Confirm `supabase/migrations/20260418021100_core_functions.sql` (which defines `is_super_admin`, `current_user_client_id`, `user_can_access_store`, `handle_new_user`) runs.
3. Seed the 3 canonical roles into `roles`:
   - `super_admin` → `permissions: ["*"]`, `is_system: true`
   - `admin` → 13 permissions from `src/lib/permissions.ts` (all non-super)
   - `user` → 8 read-only permissions
4. Ensure the `handle_new_user` trigger is active on `auth.users` so existing auth users (chethan@vizsoft.in, itt@vizsoft.in) get profile rows when they next sign in — OR backfill profiles immediately.
5. Promote `chethan@vizsoft.in` to `super_admin` in `profiles`.
6. Verify: login on proxema.io, sidebar shows Clients, Projects, Sync Runs, Webhooks, API, Users, Roles.

**Data loss:** All public-schema data is gone (acceptable — user confirmed).

## Checklist

- [ ] Reset migration: drops all public tables, functions, types, policies; preserves `auth`, `storage`, `extensions` schemas
- [ ] Re-run full migration history from `supabase/migrations/` in timestamp order
- [ ] Seed `roles` table with super_admin (`["*"]`), admin (13 permissions matching `PERMISSIONS` const in `src/lib/permissions.ts` minus SUPER_ADMIN), user (8 view-only permissions)
- [ ] Verify `handle_new_user` trigger exists on `auth.users` and `profiles` RLS allows the inserted row
- [ ] Backfill `profiles` rows for existing `auth.users` (chethan@vizsoft.in + itt@vizsoft.in)
- [ ] Update chethan@vizsoft.in profile: `role = 'super_admin'`, `is_active = true`
- [ ] Verify `is_super_admin()` returns true for that user (test via app login, not SQL editor)
- [ ] Clear browser localStorage on proxema.io before first test login (sidebar caches)

## Acceptance

- Logging in as chethan@vizsoft.in on proxema.io loads the full sidebar (Clients, Projects, Sync Runs, Webhooks, API, Users, Roles visible)
- No 403 errors in browser console on any page
- Creating a test client + test site works end-to-end