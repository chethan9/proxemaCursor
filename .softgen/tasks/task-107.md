---
title: Resume onboarding from any exit point
status: todo
priority: high
type: feature
tags: [onboarding, ux, state-recovery]
created_by: agent
created_at: 2026-04-21T04:05:00Z
position: 107
---

## Notes

User can abandon onboarding at many points (dialog close, mid-OAuth popup close, reject on WooCommerce, closed browser tab after OAuth, mid-WordPress app-password, post-WP before webhook registration). Right now there's no way to resume — the partial record either blocks re-add (URL uniqueness) or sits incomplete with no UI to continue.

### Exit points to handle

1. **Add Site dialog** — user closes dialog after entering URL/name but before OAuth redirect
2. **Mid-OAuth (WooCommerce)** — OAuth popup/tab closed before return callback
3. **OAuth rejected** — user clicked "Deny" on WooCommerce screen
4. **Post-OAuth, pre-WordPress app-password** — WC keys saved but WP credentials missing
5. **Mid-WordPress app-password flow** — popup closed
6. **Post-WP, pre-webhook registration** — all creds present, webhooks never registered
7. **Post-webhooks, pre-initial-sync** — fully onboarded but sync never kicked off
8. **Liftoff / welcome screen** — closed tab, never completed final step

### State model
Add one column `onboarding_step` to `stores` (enum: `pending_oauth`, `pending_wp_creds`, `pending_webhooks`, `pending_initial_sync`, `completed`). Derive from existing fields where possible:
- No `consumer_key` → `pending_oauth`
- Has WC keys, no `wp_user` → `pending_wp_creds`
- Has both, no webhook rows → `pending_webhooks`
- Has webhooks, no successful initial sync run → `pending_initial_sync`
- `initial_sync_done = true` → `completed`

### Resume entry points
- **Sites table** (`SitesTable`, `projects/index`): row with non-`completed` onboarding shows orange "Resume setup" button instead of the normal open action
- **Add Site dialog**: before creating, check if URL matches an existing incomplete store → show "You started onboarding this site on {date}. Resume?"
- **Dashboard** (`pages/index.tsx`): if any store is incomplete, show a banner "1 site needs setup completed — Resume"
- **Direct URL** `/sites/connect/[id]?resume=1` works for any step — the connect page reads `onboarding_step` and jumps to the right stage

### Implementation
- **Connect page** (`pages/sites/connect/[id].tsx`): add step detection at top; route to the correct stage based on `onboarding_step` rather than assuming fresh start
- **OAuth callback** (`pages/api/woocommerce/callback.ts`): on reject/error, set `onboarding_step = pending_oauth` and redirect to connect page with error toast
- **Add Site dialog** (`AddSiteDialog.tsx`): on URL blur, query for existing incomplete store with same normalized URL → if found, close dialog and redirect to `/sites/connect/{id}?resume=1`
- **Cron** (`cron/auto-fail-stuck.ts`): auto-abandon stores stuck in `pending_oauth` for > 24h so they don't clutter the sites list forever (soft delete with `abandoned_at`)

### Constraints
- Must not lose WC keys when user resumes — if consumer_key already stored, skip OAuth and jump to WP step
- Must be safe to call repeatedly — resuming a already-completed step should just move forward, not re-run
- Resume button respects role permissions (SITES_UPDATE)

## Checklist

- [ ] Add `onboarding_step` column to `stores` with enum + backfill existing rows based on derived state
- [ ] Update `storeService` to expose `getOnboardingStep(store)` helper (derives if column null)
- [ ] `AddSiteDialog`: URL-match check against incomplete stores → offer resume instead of create
- [ ] `SitesTable` / projects table: show "Resume setup" button with orange badge for non-completed stores, hiding normal actions
- [ ] Dashboard `pages/index.tsx`: banner listing incomplete sites with resume CTAs
- [ ] `pages/sites/connect/[id].tsx`: detect `onboarding_step` and render correct stage (OAuth / WP creds / webhook registration / liftoff); support `?resume=1` query
- [ ] OAuth callback: on error/deny, update step to `pending_oauth` and redirect with toast
- [ ] WordPress app-password callback: advance step on success
- [ ] Webhook registration step: advance to `pending_initial_sync` on success, trigger sync
- [ ] Liftoff screen: on "Finish", mark `completed`; if tab closed before, status remains `pending_initial_sync` and dashboard shows resume banner
- [ ] Cron: auto-mark stores stuck in `pending_oauth` > 24h as abandoned (soft delete)
- [ ] Verify: close dialog mid-URL-entry → resume. Close OAuth popup → resume. Reject OAuth → resume. Close tab post-OAuth pre-WP → resume. Close tab on liftoff → dashboard shows resume banner.

## Acceptance

- User can close the browser at any onboarding step and come back to a "Resume setup" CTA that drops them exactly where they left off.
- No duplicate site entries — re-entering the same URL surfaces the in-progress one.
- No re-doing completed steps on resume (OAuth skipped if keys already stored, etc.).