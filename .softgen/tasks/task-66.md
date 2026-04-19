---
title: Async onboarding — estimate + background sync + space-themed progress
status: done
priority: urgent
type: feature
tags: [onboarding, ux, sync, progress]
created_by: agent
created_at: 2026-04-19
position: 66
---

## Notes
Problem: the connect wizard's last step waits for a full initial sync to finish, which blocks the user for minutes on large stores and feels frozen. Sites are ready to use the moment webhooks are registered — the sync can happen in the background.

**New flow:**
1. After webhooks register, wizard moves to a new "Preparing Liftoff" step.
2. Backend fetches counts from WooCommerce (products, orders, customers, categories, tags) using `?per_page=1` and reading `X-WP-Total` response header. Fast pre-flight (~2s).
3. Screen shows: estimated counts per entity + total estimated duration (rough formula: `ceil(total_items / 100) * 1.5s` per aspect, summed). Sample: "~1,240 products · ~3,800 orders · estimated 4 min".
4. User clicks "Start Sync" → backend kicks off the initial sync run (fire-and-forget), immediately redirects user to site dashboard with `sync_run_id` in store.
5. Dashboard + all site pages (products/orders/customers/taxonomy) render a sticky `<SyncBanner />` at the top showing live progress: `"Syncing 34% · ~2 min remaining · Beaming products from orbit 🛰️"`. Rotating space-themed status messages every 4s.
6. Pages render partial data as it streams in (already queryable from Supabase mirror — just show whatever's there with a "syncing in progress" hint when empty). No hard block anywhere.
7. Banner dismisses itself when `sync_runs.status = 'completed'`. Toast: "Liftoff complete 🚀 Your store is fully synced."

**Space-themed copy rotation (every 4s while active):**
- "🚀 Calibrating thrusters..."
- "🛰️ Beaming products from orbit..."
- "🌑 Mapping the customer constellation..."
- "⭐ Charting order trajectories..."
- "🪐 Almost to Proxima..."
- "🌌 Crossing the final sync..."

**Animation / branding:**
- On the "Preparing Liftoff" step: a lightweight CSS-animated rocket (or Lottie from lottiefiles.com — rocket-launch or planet-orbit). Keep it ~200px, centered above the counts card.
- On the progress banner: small orbit-dot animation (CSS only, no Lottie needed here).

**Endpoints:**
- `GET /api/stores/[storeId]/estimate` — returns `{ counts: { products, orders, customers, categories, tags }, estimatedDurationSec }`. Uses WooCommerce REST with `?per_page=1` and reads the `X-WP-Total` header via the existing `wooRequest` helper (need to expose raw headers — small extension to woo-client).
- `POST /api/stores/[storeId]/sync/start-initial` — wrapper around existing sync trigger that tags the run as `is_initial: true` for banner detection.
- `GET /api/stores/[storeId]/sync/active` — returns latest running sync_run: `{ running, progress (0-100), eta_seconds, current_aspect, totals, processed }`.

**Hooks / state:**
- `useActiveSync(storeId)` — polls `/sync/active` every 2s while running, stops when completed/failed. Returns null when no active sync.
- Provide via a light `SyncContext` at `SiteLayout` level so banner + pages can subscribe.

**Banner component:** `src/components/site/SyncBanner.tsx`
- Sticky top, 44px tall, gradient bg (slate-900 to indigo-900), white text
- Left: animated orbit dot + rotating status line
- Center: thin progress bar (0-100%)
- Right: "View details" link → opens small drawer with per-aspect breakdown (products: 340/1240, orders: 80/3800 ...) + ETA

**Dashboard integration:** Site home (`/sites/[id]/home`) gets a "First sync in progress" card variant when active, with the same progress info + a reassuring "You can close this page — sync continues in the background."

**Minor schema:** add `is_initial boolean default false` + `estimated_total integer` + `processed_total integer` to `sync_runs` table for banner math. Update the existing sync runner to increment `processed_total` as it processes items.

**Connect wizard `src/pages/sites/connect/[id].tsx`:** replace current "Starting initial data sync" step with the new "Preparing Liftoff" step (counts + estimate + Start Sync button). After click, redirect to `/sites/{id}/home`.

## Checklist
- [ ] Add `is_initial`, `estimated_total`, `processed_total` columns to sync_runs; expose count-helper from woo-client that returns X-WP-Total
- [ ] Estimate endpoint returning per-entity counts and total estimated duration in seconds
- [ ] Start-initial endpoint kicking off async sync tagged as initial
- [ ] Active-sync endpoint returning running run with progress, ETA, current aspect, totals
- [ ] useActiveSync hook with 2s polling while active, SyncContext provider in SiteLayout
- [ ] SyncBanner sticky at top of SiteLayout with animated orbit dot, rotating space-themed status messages every 4s, progress bar, and "View details" drawer
- [ ] Connect wizard final step redesigned as "Preparing Liftoff" with counts table, estimate, rocket animation (Lottie or CSS), and Start Sync button
- [ ] Site home card variant: "First sync in progress" with full breakdown and reassurance copy
- [ ] All site pages (products/orders/customers/taxonomy) show partial Supabase data immediately with banner on top
- [ ] Sync runner updates `processed_total` as it ingests items so banner can compute real %

## Acceptance
- User completing connect wizard sees counts + estimate within 3 seconds of credentials step finishing
- Clicking Start Sync redirects to site dashboard immediately; banner appears with live progress
- Closing and reopening the browser tab resumes the banner where it left off (polling picks up server state)
- Status messages rotate through space-themed copy while sync runs
- Banner dismisses + success toast fires when sync completes