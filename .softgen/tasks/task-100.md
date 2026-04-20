---
title: Instant onboarding + progressive background sync
status: todo
priority: high
type: feature
tags: [onboarding, sync, ux]
created_by: agent
created_at: 2026-04-20
position: 100
---

## Notes

Replace the "scan inventory + preparing for liftoff + estimate" flow with an **instant handoff** to the products page. Sync happens progressively in the background so the user feels the app is ready immediately.

**New onboarding flow (4 steps instead of 6):**
1. Authorizing with WooCommerce
2. Receiving API credentials
3. Authorize WordPress media access
4. Registering webhooks
→ Confetti modal → auto-redirect to products page of the site

**Prefetch window (between webhook registration and user landing on products page, ~10-15s):**
- Fetch latest 50 products (page=1, per_page=50, orderby=modified)
- Fetch latest 50 orders (page=1, per_page=50, orderby=date)
- Fetch ALL categories (usually small, paginate internally if >100)
- Upsert everything into Supabase mirror tables
- User lands on products page → data is already there → feels instant

**Background sync (Phase 2 — starts after prefetch completes):**
- Sequential, one-aspect-at-a-time to avoid WooCommerce throttling:
  1. Remaining products (page 2 onwards, per_page=100)
  2. Remaining orders (page 2 onwards, per_page=100)
  3. All tags
  4. All customers
  5. All coupons
- Resumable: each aspect tracks `last_page_synced` in `sync_runs` so a crash picks up where it left off
- Progress updates drive the existing sidebar circle + green progress bar + projects widget (keep these — user likes them)

**Phase 3 — variations (on-demand + background):**
- After Phase 2 completes, start background variation sync per-product
- If user clicks edit on a variable product before its variations are synced → fetch that product's variations on-demand via existing `/api/stores/[storeId]/products/[productId]/variations` endpoint, cache to db, show immediately
- Any fetched data not in db should be upserted (cache-on-read pattern)

**Cache-on-read everywhere:**
- When site pages load data, if product/order is missing from mirror → fetch from Woo API → upsert → return. User never sees "not found" during initial sync.

**Persistent banner:**
- Small non-intrusive banner on ALL site pages (products, orders, categories, tags, home, settings) while `onboarding_completed_at IS NOT NULL AND initial_sync_completed_at IS NULL`
- Copy: "Initial sync in progress — performance will be fully optimized once complete." Dismissible per-session but reappears on reload until sync done.
- Auto-hides when `initial_sync_completed_at` is set

**Files/areas to change:**
- `src/pages/sites/connect/[id].tsx` — remove "Scanning inventory" + "Preparing for liftoff" steps from the UI state machine, remove the estimate fetch, remove the liftoff card with counts. After webhooks register successfully → trigger prefetch API → show confetti modal → redirect to `/sites/[id]/products`
- `src/pages/api/stores/[storeId]/sync-start.ts` — rename/rework into a prefetch endpoint that synchronously fetches & upserts the 50 products + 50 orders + all categories, then queues Phase 2 in background. Mark `onboarding_completed_at` here.
- `src/pages/api/stores/[storeId]/sync.ts` — adjust to support sequential aspect progression with resumable page tracking (products → orders → tags → customers → coupons → variations). The cron scheduler already drives this.
- `src/pages/api/cron/sync-scheduler.ts` — ensure it picks up Phase 2/3 runs and progresses them one aspect at a time per tick
- `src/components/SyncProgressBanner.tsx` — keep as-is (sidebar circle + green bar). Already wired to `useAllActiveSyncs`.
- New: `src/components/site/InitialSyncBanner.tsx` — small banner shown in `SiteLayout` when onboarding done but initial sync incomplete
- `src/components/layout/SiteLayout.tsx` — mount the banner at top of content area
- `src/pages/sites/[id]/products.tsx`, `orders.tsx`, `categories.tsx`, `tags.tsx`, `home.tsx` — add cache-on-read fallback: if a specific row is requested and missing from mirror, fetch from Woo, upsert, return (can be centralized in service layer: `productService.getOrFetch`, `orderService.getOrFetch`)
- `src/components/product-edit/*` — when editing a variable product with no variations in db, trigger on-demand variations fetch (endpoint already exists)
- Remove the estimate card/counts from the liftoff screen entirely — no more `/api/stores/[storeId]/estimate` call during onboarding

**Keep unchanged:**
- Sidebar mini progress circle on site pages
- Green progress bar beneath sidebar header showing current aspect + %
- Projects page sync progress widget
- The resume-onboarding flow from task 99 (still covers exits during the 4 auth steps)

## Checklist

- [ ] Strip "Scanning inventory" and "Preparing for liftoff" steps from `INITIAL_STEPS` in connect page — final array has exactly 4 entries (auth, creds, wp, webhooks)
- [ ] Remove from `src/pages/sites/connect/[id].tsx`: `Estimate` interface, `estimate` / `estimateStartedRef` / `progressTick` state, `startEstimate()`, `runEstimateAndLiftoff()`, `handleLiftoff()`, the `formatEta` helper, the progress-tick `setInterval`, the `pickProgressMessage` import, the entire liftoff card JSX block, the entire "estimating" stage JSX block, the `stage === "estimating"` / `"liftoff"` branches in the title switch
- [ ] Delete `src/pages/api/stores/[storeId]/estimate.ts` entirely (no longer called)
- [ ] Update `Stage` type in connect page: replace `"estimating" | "liftoff"` with single `"prefetching"` state; render confetti modal + auto-redirect during this state
- [ ] After webhooks register: call new prefetch endpoint, show full-screen confetti modal with "Welcome to {store name}!" and auto-redirect to `/sites/[id]/products` after 2s
- [ ] New prefetch endpoint (`/api/stores/[storeId]/prefetch` or repurpose `sync-start`): fetch + upsert latest 50 products (per_page=50, orderby=modified), latest 50 orders (per_page=50, orderby=date), all categories in parallel; stamp `onboarding_completed_at`; queue background sync_run for Phase 2
- [ ] Simplify `src/pages/api/stores/[storeId]/sync-start.ts`: drop `estimated_total` from request body contract (default 0), keep onboarding stamp logic, keep background sync trigger
- [ ] Phase 2 background sync in `sync.ts`: sequential aspect progression (remaining products → orders → tags → customers → coupons), one at a time, per_page=100, resumable from last page via `sync_runs.last_page_synced`
- [ ] Phase 3 background sync: after Phase 2 done, sync variations per-product in background (separate sync_run with `aspect='variations'`)
- [ ] Cache-on-read helpers in service layer: `productService.getOrFetch(storeId, wooId)`, `orderService.getOrFetch(storeId, wooId)` — falls back to live Woo fetch + upsert when missing
- [ ] On-demand variations: product edit page detects missing variations for variable products → calls existing `/api/stores/[storeId]/products/[productId]/variations` → caches → renders
- [ ] New `src/components/site/InitialSyncBanner.tsx`: thin banner, mounts via `SiteLayout`, visible while `onboarding_completed_at IS NOT NULL AND initial_sync_completed_at IS NULL`, dismissible per-session (sessionStorage key), auto-hides when `initial_sync_completed_at` set
- [ ] Mount `InitialSyncBanner` at top of content area in `src/components/layout/SiteLayout.tsx`
- [ ] Remove `pickProgressMessage` export from `src/lib/sync-messages.ts` if no other callers remain (keep `pickAnyMessage` — still used by SyncProgressBanner); if `progress` pool is unused elsewhere, remove it too
- [ ] Preserve untouched: `SyncProgressBanner.tsx` (sidebar circle + green bar), projects widget, `useAllActiveSyncs` / `useActiveSync` hooks, resume-onboarding logic from task 99
- [ ] Verify no lingering references to `/api/stores/[storeId]/estimate` with a grep after edits
- [ ] Manual auth mode support: when user chooses "Enter consumer key/secret manually" in AddSiteDialog (skipping OAuth), the new instant-onboarding flow still applies — after credentials saved, show 4-step card starting at WP authorize step, then webhooks, then confetti + prefetch + redirect. Same code path as OAuth.
- [ ] Resume into new flow: task 99's resume logic (via `/sites/connect/[id]?resume=1`) picks up at correct step (WP if `wp_username` null, webhooks if not registered, prefetch + confetti if all creds present) — ends in confetti + redirect just like fresh flow. No leftover liftoff card or estimate stage in any resume path.
- [ ] Global incomplete-onboarding prompt: new `<IncompleteOnboardingPrompt />` component mounts in `_app.tsx` (inside AuthProvider). On app load, queries `stores` where `onboarding_completed_at IS NULL` for current user's clients. If 1+ found, shows a centered modal: "You have {N} site(s) with setup in progress — resume now?" with Resume (routes to `/sites/connect/[first-id]?resume=1`) and Dismiss buttons. Dismissible per-session via sessionStorage key `resume-prompt-dismissed`. Does not show on `/sites/connect/*`, `/auth/*`, or `/sites/[id]/*` pages (user already in flow or actively using site).
- [ ] Update `docs/CODEBASE_INDEX.md` and `docs/JOURNAL.md` with the new onboarding flow: 4-step card → confetti → prefetch window (top 50 products, 50 orders, all categories) → Phase 2 background (remaining products, orders, tags, customers, coupons sequentially) → Phase 3 background (variations on-demand + full). Document the resume entry points (sites table, AddSite duplicate detection, global modal prompt) and that both OAuth and manual-credential paths use the identical post-credentials flow.

## Acceptance

- Completing the 4 auth steps shows confetti and drops the user on the products page within ~2s of "Registering webhooks" turning green.
- Latest 50 products + 50 orders + all categories are visible immediately on first landing (no empty state, no spinner for the initial rows).
- A thin banner on every site page reads "Initial sync in progress — performance will be fully optimized once complete" until the full sync finishes, then disappears.
- The sidebar progress circle and green bar continue showing live progress of products → orders → tags → customers → coupons → variations.
- Clicking edit on a variable product whose variations haven't synced yet still loads variations (fetched on-demand and cached).
- User who adds a site via manual consumer key/secret lands in the same 4-step card (starting at WP authorize) and ends with confetti + products page.
- User who abandons onboarding, refreshes the app, sees a resume prompt modal on any page (except the connect page itself) within 2 seconds of load.
- Resuming via sites-table button, AddSite duplicate warning, or global modal all land on the same connect page at the correct step.