# Change Journal

Append-only log of meaningful changes. Newest on top. Every agent session that modifies code, schema, or docs adds an entry here.

**Entry format:**
```
## YYYY-MM-DD — short title
**Scope:** feature | bug | chore | refactor | docs | schema
**Commit:** <hash or "uncommitted">
**Files:** key files touched
**Why:** one-line reason
**What:** bullet list of changes
**Follow-ups:** anything deferred
```

Keep entries concise. Link to task files (`.softgen/tasks/task-N.md`) or PRs when relevant.

---

## 2026-04-20 — Instant onboarding + progressive background sync

**Scope:** feature
**Commit:** uncommitted
**Files:** `src/pages/sites/connect/[id].tsx`, `src/pages/api/stores/[storeId]/prefetch.ts` (new), `src/pages/api/stores/[storeId]/sync-start.ts`, `src/pages/api/stores/[storeId]/estimate.ts` (deleted), `src/pages/api/stores/[storeId]/products/by-woo/[wooId].ts` (new), `src/pages/api/stores/[storeId]/orders/by-woo/[wooId].ts` (new), `src/components/site/InitialSyncBanner.tsx` (new), `src/components/IncompleteOnboardingPrompt.tsx` (new), `src/components/product-edit/tabs/VariantsTab.tsx`, `src/components/layout/SiteLayout.tsx`, `src/pages/_app.tsx`, `src/services/productService.ts`, `src/services/orderService.ts`, `src/lib/sync-messages.ts`, `src/pages/api/stores/[storeId]/sync.ts` (ref `task-100`)
**Why:** Old onboarding made users wait through a "scanning inventory" + "preparing for liftoff" estimate stage before landing in the app. New flow gets them to a usable products page in ~3 seconds by prefetching the top 50 products/orders + all categories in parallel during the post-webhook redirect, then syncing the rest in the background sequentially.
**What:**
- **Connect page**: trimmed from 6 steps to 4 (auth → creds → WP → webhooks). After webhooks, shows full-screen confetti modal "Welcome to {store}!" and auto-redirects to `/sites/[id]/products` after 2.2s.
- **Prefetch endpoint** (`POST /api/stores/[storeId]/prefetch`): fires during the confetti window. Parallel fetch + upsert of latest 50 products (orderby=modified), latest 50 orders (orderby=date), and all categories. Stamps `onboarding_completed_at`. Kicks off Phase 2 background sync via `sync-start`.
- **Sync engine aspect order**: reordered to products → orders → categories → tags → customers → coupons → variations. Variations runs last (Phase 3) so the user sees meaningful data first and variations are only needed when editing.
- **Cache-on-read**: new `productService.getOrFetchProductByWooId()` and `orderService.getOrFetchOrderByWooId()` — if a record isn't in local DB yet, hit the new `/api/stores/[id]/products/by-woo/[wooId]` or `/orders/by-woo/[wooId]` endpoint which fetches from Woo, upserts, returns. Gaps fill transparently as users navigate.
- **Variations lazy-load**: product edit page no longer fetches variations upfront. `VariantsTab` auto-loads when the user opens a variable product; indicator shows "Loading from WooCommerce…" while on-demand, or "Live from WooCommerce" pill once loaded. Reuses existing `/api/stores/[id]/products/[productId]/variations` (DB-first with Woo fallback + upsert).
- **InitialSyncBanner**: thin dismissible banner mounted in `SiteLayout`, visible while `onboarding_completed_at` is set but `initial_sync_completed_at` is null. Shows "Initial sync in progress — performance will be fully optimized once complete".
- **IncompleteOnboardingPrompt**: global modal mounted in `_app.tsx`. On app load, queries for stores with `onboarding_completed_at IS NULL`. If any found (and user is not already on `/sites/connect/*`, `/auth/*`, or inside a site), shows a dialog prompting resume. Dismissible per-session via `sessionStorage`.
- **Cleanup**: deleted `estimate.ts` API, removed estimate/liftoff stages from connect page, removed `pickProgressMessage` helper from `sync-messages.ts`, dropped `estimated_total` from `sync-start` request contract.
- Both OAuth and manual-credential paths funnel through the same post-credentials flow (WP authorize → webhooks → confetti).
- Resume flow from task 99 works with new card: `?resume=1` lands at the correct step, ends in the same confetti + redirect.

**Follow-ups:**
- Variations are still synced fleet-wide in Phase 3. For stores with 1000s of products this could be long — consider per-product on-demand only + skip Phase 3 entirely in a future iteration.
- Cache-on-read helpers (`getOrFetchProductByWooId` / `getOrFetchOrderByWooId`) are available but not yet wired into product/order list components — wire in when a user reports a "product not found" glitch during initial sync.

## 2026-04-19 — Codebase index + change journal introduced
**Scope:** docs
**Commit:** uncommitted
**Files:** `docs/CODEBASE_INDEX.md` (new), `docs/JOURNAL.md` (new)
**Why:** Make structural navigation and change tracking easier across sessions. Agent will append to JOURNAL.md on every meaningful change from now on.
**What:**
- Created `CODEBASE_INDEX.md` — full map of routes, API surface, services, hooks, libs, DB tables, design tokens, known refactor candidates.
- Created `JOURNAL.md` — this file. Append-only log format defined above.
**Follow-ups:**
- Refactor candidates listed in `CODEBASE_INDEX.md` (ProductsTab 1101 lines, OrdersTab 892, sync-runs page 675, etc.) — tackle opportunistically when touching those files for other reasons.
- Clean lint warnings (unused imports, exhaustive-deps in settings pages, 2 non-null assertions in `storeService.ts`).

## 2026-04-19 — Stable release v2 tag
**Scope:** chore
**Commit:** `217a3d7` (local; push deferred to user via Publish)
**Files:** repo-wide (no code changes, audit only)
**Why:** Mark a stable checkpoint after product/orders/filter refinements.
**What:**
- Verified `tsc --noEmit` clean.
- `next lint` — warnings only (unused imports, exhaustive-deps, 2 non-null assertions). No errors.
- Committed with message `chore: stable release v2`.
**Follow-ups:** User to click **Publish** to push to GitHub.

## 2026-04-19 — Add "Bulk Jobs" to site sidebar

**Why:** Bulk Jobs page existed at `/sites/<id>/bulk-jobs` but had no nav entry, so users couldn't find it.
**Changes:**
- `src/lib/menu-registry.ts`: registered `site-bulk-jobs` item (Layers icon, "Manage" group, path `/bulk-jobs`). Added `Layers` to ICON_MAP.
**Impact:** Bulk Jobs now appears in site sidebar under "Manage" for new menu configs. Existing saved site menu configs per role will show it under "Unassigned (new)" group until re-saved via menu editor.

## 2026-04-19 — Sidebar reorder + user default landing page

**Scope:** feature + schema
**Files:** `src/lib/menu-registry.ts`, `src/contexts/AuthProvider.tsx`, `src/pages/auth/login.tsx`, `src/pages/settings/profile.tsx`, `profiles` table
**Why:** Users wanted Stores first in the sidebar and a way to pick their own post-login landing page.
**What:**
- Renamed "Dashboard" → "Health".
- Reordered default groups: Stores → Overview → Management → Operations → Developer → Administration → System.
- Added `profiles.default_landing_path text` column.
- Settings → Profile now has a "Default Landing Page" card (dropdown of all menu items the user can access).
- Login now redirects to the saved `default_landing_path` (fallback `/`).
**Follow-ups:** Existing saved role menu configs won't reflect the rename/reorder until re-saved via Menu Editor.

## 2026-04-19 — Sidebar polish: width, spacing, site active state

**Scope:** bug + ui
**Files:** `src/components/layout/AppSidebar.tsx`
**Why:** Uneven group gaps (leftover `mb-1`/`mb-3`), site rows didn't highlight when on `/sites/<id>/*`, sidebar was too wide.
**What:**
- Width: `w-52` → `w-44`.
- Unified all group wrappers to `mb-2`.
- Active site check now matches `/explore/<id>` OR `/sites/<id>` prefix.

## 2026-04-19 — Fix blank flash on clicking site after fresh login

**Scope:** bug
**Files:** `src/components/layout/AppSidebar.tsx`
**Why:** Sidebar linked sites to `/explore/<id>`, a redirect-only page. Users saw a blank render tick before `router.replace` fired.
**What:** Direct link to `/sites/<id>/products`, skipping the redirect page.

## 2026-04-19 — Branded 404 with auto-redirect to Projects

**Scope:** ui
**Files:** `src/pages/404.tsx`
**Why:** Requested friendlier 404 — show brand and send users home.
**What:** 404 page now renders logo + brand name, message, "Go to Projects" button, auto-redirects to `/projects` after 5s.

## 2026-04-19 — Instant site sub-nav: cached store + hover prefetch

**Scope:** performance
**Files:** `src/components/site/shared.tsx`, `src/pages/sites/[id]/settings.tsx`, `src/components/layout/SiteSidebar.tsx`
**Why:** Clicking Products/Orders/etc in a site showed a 2-3s full-page blank/skeleton because each page re-fetched the store with local state.
**What:**
- `useSiteFromRoute` now uses React Query with `initialData` seeded from the sidebar's cached sites list in localStorage — store data is synchronous on navigation.
- Sub-pages get `loading = false` when seeded, so shell stays visible; only inner tables show their own loading state.
- Site sidebar items prefetch first page of products/orders/categories/tags on hover/focus, warming the React Query cache.

## 2026-04-19 — Sidebar skeleton while auth loads

**Scope:** ui/bug
**Files:** `src/components/layout/AppSidebar.tsx`
**Why:** Before profile/role loaded, permission checks returned false so only perm-less items (Projects, Settings) rendered, then the rest popped in — looked broken.
**What:** Render 8-row skeleton while `auth.loading` is true and no cached menu tree is available. Real menu swaps in once role + permissions resolve.

## 2026-04-19 — Fix role constants: staff/readonly → user

**Scope:** bug
**Files:** `src/services/menuConfigService.ts`, `src/components/layout/AppSidebar.tsx`, `src/components/layout/SiteSidebar.tsx`
**Why:** Code referenced `staff`/`readonly` roles that don't exist in the DB (actual roles: `super_admin`, `admin`, `user`). This caused wrong menu caching keys and possible menu resolution mismatches.
**What:** Updated `RoleKey` type and `roleKeyFor` fallbacks to return `user`. Cached menu candidate list updated.