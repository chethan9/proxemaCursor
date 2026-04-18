---
title: Restore Sync Engine page at /sites/[id]
status: todo
priority: urgent
type: bug
tags: [sites, restore, regression]
created_by: agent
created_at: 2026-04-18
position: 2
---

## Notes
The site detail page at `src/pages/sites/[id]/index.tsx` is currently 0 lines (empty). Previously it was a 1934-line mega-page showing the Sync Engine UI with tabs: Sync Engine / Data / Webhooks / Logs / History / Deleted / Settings (see user's 2nd screenshot).

This is the page users land on when clicking a site card from /sites. It MUST be restored so the Sites → click site → Sync Engine flow works again.

**Recovery source:** `git show 9160981^:"src/pages/sites/[id]/index.tsx"` contains the full 1934-line original. Use this as the restoration base.

**Important:** Do NOT split this into sub-pages yet. Restore it as-is so users can work again. The per-site route split (products/orders/categories separate pages) is a separate task (task-39).

**Existing context:**
- `src/pages/sites/[id]/_shared.tsx` (88 lines) exists — shared site layout shell
- `src/components/layout/SiteSidebar.tsx` (250 lines) exists — secondary sidebar
- `src/components/layout/SiteLayout.tsx` (28 lines) exists — layout wrapper
- Other per-site stub pages exist but are skeletons (home/products/orders/tags/categories/settings)

**Dependencies to verify still exist:** StatusBadge, useStore hook, syncService, webhookService, EntityHistory component, JsonTableView, DataExplorer.

## Checklist
- [ ] Run `git show 9160981^:"src/pages/sites/[id]/index.tsx" > /tmp/old-site-page.tsx` to extract the original
- [ ] Review the restored code — identify any imports that reference deleted/renamed modules
- [ ] Create `src/pages/sites/[id]/index.tsx` with the restored content
- [ ] Fix any broken imports (especially `@/lib/cache` if present — it's being deleted in task-37)
- [ ] Replace any `browserCache` / `CACHE_KEYS` / `CACHE_TTL` usage with React Query equivalents (useStore, useSyncRuns, etc.)
- [ ] Verify the page uses `SiteLayout` or `AppLayout` correctly (match the pattern used by the other restored site pages)
- [ ] Test: from /sites, click a site card — lands on Sync Engine view with all tabs visible
- [ ] Run check_for_errors, fix any type/lint issues
- [ ] Since this file will be ~1934 lines, note it for future refactor (not now — user needs it working first)