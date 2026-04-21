---
title: Scope dashboards and logs to user's own stores
status: todo
priority: urgent
type: bug
tags: [security, rls, multi-tenant]
created_by: agent
created_at: 2026-04-21T07:35:00Z
position: 112
---

## Notes
Non-super-admin users currently see fleet-wide data: dashboard Health widgets, Sync Runs page, Webhook Activity page all aggregate across every store in the DB, not just the ones the user owns. This leaks other tenants' data.

Scoping rule:
- Super admin: sees everything (current behavior).
- Everyone else: sees only stores where `stores.user_id = auth.uid()` (the user who added the site).

Affected surfaces:
- `src/pages/index.tsx` (Dashboard): stats cards, Fleet Health card, Attention row, charts, Recent Sites, Recent Sync Runs — all derive from `useStores()` and `useSyncRuns()`. Also remove the "Clients" stat card entirely for non-super-admins (already superAdminOnly in menu, but the widget still renders on dashboard).
- `src/pages/sync-runs/index.tsx`: `useSyncRunsPaged`, `useStoreOptions`, `useSyncRunsStats` must filter by user's stores.
- `src/pages/webhooks/activity.tsx`: `webhook_events` query, store dropdown, stats — all filter by user's stores.
- Any other log surfaces that query `sync_runs`, `webhook_events`, `stores` directly.

Implementation approach:
- Check existing RLS on `stores`, `sync_runs`, `webhook_events` via `get_database_schema`. If RLS already restricts non-admins to own rows, client queries return scoped data automatically — verify and remove any client-side fleet-wide assumptions.
- If RLS is not scoped, add policies: SELECT where `stores.user_id = auth.uid() OR is_super_admin(auth.uid())`. For `sync_runs`/`webhook_events`, scope through `store_id → stores.user_id`.
- Update `useStores`, `useSyncRuns`, `useStoreOptions`, `useSyncRunsStats`, `useSyncRunsPaged` to respect the scoping (if they use service role or bypass RLS, stop doing that for non-admins).
- Dashboard: hide Clients stat card when `!isSuperAdmin`. Keep Fleet Health but relabel to "Your Sites Health" for non-admins.

## Checklist
- [ ] Verify RLS policies on stores, sync_runs, webhook_events scope non-admin users to their own stores (via stores.user_id)
- [ ] Dashboard stats, charts, Recent Sites, Recent Sync Runs show only the user's own stores for non-super-admins
- [ ] Remove Clients stat card from dashboard for non-super-admin users
- [ ] Rename "Fleet Health" card to "Sites Health" for non-super-admin users
- [ ] Sync Runs page: stats, store filter dropdown, and table rows scoped to user's stores
- [ ] Webhook Activity page: stats, store filter dropdown, and table rows scoped to user's stores
- [ ] Super admin behavior unchanged — still sees all data fleet-wide

## Acceptance
- Logged in as a regular user who owns 2 sites: dashboard, sync-runs, and webhook activity pages show data only for those 2 sites (no other tenants' rows visible).
- Logged in as super admin: same pages show fleet-wide data as before.
- Clients stat tile is absent from the dashboard for non-super-admin users.