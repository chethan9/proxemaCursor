---
title: Resume incomplete site onboarding
status: done
priority: high
type: feature
tags: [onboarding, sites, resume, ux]
created_by: agent
created_at: 2026-04-20
position: 99
---

## Notes

Site onboarding is a multi-step flow (OAuth/manual keys → WP app password → webhook registration → estimate → liftoff). Users can bail out or lose the tab at any step, leaving a half-connected store with no way to pick up where they left off. Today the `stores` row persists but the connect wizard (`src/pages/sites/connect/[id].tsx`) only runs meaningfully when `?success=1` is in the URL, and the sites list (`src/components/project/SitesTable.tsx`, `src/pages/projects/[id].tsx`, `src/pages/index.tsx`, `src/pages/clients/[id].tsx`) gives no visual cue that a site is half-done.

Goal: every intermediate state is recoverable. The connect page becomes the canonical resume entry point — it detects state from the `stores` row and jumps to the correct step. Sites list surfaces a clear "Resume setup" affordance. Duplicate-adds are prevented.

State model (derive from existing columns + one new flag):
- `stores.onboarding_completed_at timestamptz NULL` — new column; set when initial sync is kicked off via `/api/stores/[id]/sync-start`.
- Resume-step derivation (in order):
  1. No `consumer_key`/`consumer_secret` → **Step: credentials** (retry OAuth or switch to manual).
  2. Has keys, no `wp_username` → **Step: WordPress authorize** (with manual-entry fallback + skip).
  3. Has keys, has `wp_username` (or user skipped WP), no `onboarding_completed_at`, no active sync → **Step: webhooks + estimate + liftoff**.
  4. `onboarding_completed_at` set → redirect to `/sites/[id]/products`.

Exit points to cover:
- Dialog closed before submit → no row, nothing to resume (expected).
- Tab closed during OAuth redirect, or user rejects on WooCommerce → pending row with no keys → resume offers "Restart OAuth" (same `buildWooCommerceAuthUrl`) and "Switch to Manual Keys" (inline form to paste `ck_`/`cs_`, hits existing update endpoint).
- Tab closed after OAuth callback writes keys but before WP step → resume lands on WP authorize step.
- WP authorize rejected or tab closed mid-WP → resume lands on WP step with manual-entry panel pre-expanded and warning message.
- Tab closed after WP but before webhook registration / liftoff → resume runs webhook registration + estimate automatically, then shows liftoff.
- Webhook registration failed and user closed tab → resume re-attempts (same retry/skip UX already in place).
- Tab closed on liftoff screen before clicking Launch → resume shows liftoff card directly using cached estimate (re-fetch if needed).

Duplicate prevention: in `AddSiteDialog`, when user types a URL, check `stores` for an existing row with matching cleaned URL that is not `onboarding_completed_at`. If found, show inline notice: "You already started adding this site — Resume setup" with a link to `/sites/connect/[id]`. Create-button disabled while the match is shown.

Make the connect page tolerant of missing `?success=1` — if `id` resolves to a store row, run the same detection logic. Keep `?success=1` for fresh OAuth returns (triggers the credential polling loop). Add `?resume=1` variant that skips the polling loop and goes straight to step detection.

Sites list surfaces:
- `SitesTable` row: when `onboarding_completed_at IS NULL`, replace the normal action cluster with an amber "Setup incomplete" status pill + "Resume" button linking to `/sites/connect/[id]?resume=1`.
- Dashboards (`src/pages/index.tsx`, `src/pages/projects/[id].tsx`, `src/pages/clients/[id].tsx`): compact banner at the top listing count of incomplete sites with a "Resume" link per site (max 3, then "+N more").

Migration required: `ALTER TABLE stores ADD COLUMN onboarding_completed_at timestamptz NULL;` plus a backfill `UPDATE stores SET onboarding_completed_at = updated_at WHERE status = 'connected' AND EXISTS (SELECT 1 FROM sync_runs WHERE store_id = stores.id AND kind = 'initial');` (adjust to actual sync-runs schema — verify via `get_database_schema` before migrating).

Server change: `/api/stores/[storeId]/sync-start.ts` should set `onboarding_completed_at = now()` on the store when `is_initial` is true. Confirm via the file before editing.

Telemetry (nice-to-have, not required): log an `onboarding_step_entered` row when resume lands on each step, so we can see where users drop off.

## Checklist

- [x] Schema: add `stores.onboarding_completed_at` column, backfill for already-synced stores, regenerate types
- [x] `/api/stores/[storeId]/sync-start` sets `onboarding_completed_at = now()` when kicking off the initial sync
- [x] Connect wizard detects current step from store row on mount (no `?success=1` required); supports `?resume=1` variant that skips credential polling
- [x] Credentials step (no keys yet): shows "Restart OAuth" button + "Switch to Manual Keys" inline form (consumer key / secret → saves via store update, advances to WP step)
- [x] WP step reached via resume shows manual-entry panel expanded with "We lost the connection — authorize again or enter manually" copy, plus Skip option
- [x] Webhook + estimate + liftoff step reached via resume auto-runs webhook registration and estimate, lands on liftoff card (replaced by confetti + prefetch in task 100)
- [x] Liftoff step reached via resume re-fetches estimate if missing and shows launch button directly (replaced by confetti auto-redirect in task 100)
- [x] Fully completed sites (`onboarding_completed_at` set) redirect from connect page to `/sites/[id]/products`
- [x] `AddSiteDialog` checks for existing incomplete store matching entered URL; shows "Resume setup" inline notice with link and disables create button
- [x] `SitesTable` row: amber "Setup incomplete" pill + "Resume" button for rows where `onboarding_completed_at` is null
- [x] Dashboard pages (index, projects/[id], clients/[id]): banner listing incomplete sites with per-site resume links — superseded by global `IncompleteOnboardingPrompt` modal (task 100), which covers all pages more broadly
- [x] Empty state when no incomplete sites — banner hidden entirely (global modal auto-hides when zero incomplete sites)
- [x] Manual "Switch to manual" path from credentials step stores the keys and advances without needing a fresh OAuth round-trip

## Acceptance

- Closing the browser at any onboarding step and returning via the sites list produces a working "Resume" entry point that lands the user on the correct step with no data loss.
- Re-entering the same store URL in Add Site surfaces the existing incomplete record instead of creating a duplicate.
- Once a site has kicked off its initial sync, the connect page no longer intercepts — visiting it redirects to the site dashboard.