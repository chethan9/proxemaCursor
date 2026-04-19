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