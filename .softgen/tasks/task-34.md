---
title: Redirect legacy /explore/[id] routes and remove Tabs UI
status: todo
priority: medium
type: chore
tags: [routing, cleanup]
created_by: agent
created_at: 2026-04-18T14:15:00Z
position: 34
---

## Notes
After tasks 31-33, the tabs-based UI inside `sites/[id]` is gone and replaced by per-page navigation via SiteSidebar. Clean up legacy paths.

**Scope:**
- `src/pages/explore/[id].tsx` (1267 lines) is the old explore mega-page — redirect to `/sites/[id]` so old links don't break
- `src/pages/explore/index.tsx` — redirect to `/sites`
- Update `AppSidebar.tsx` — the `group-stores` group currently links site items to `/explore/[id]`; change to `/sites/[id]`
- Any internal `<Link>` to `/explore/...` → update to `/sites/...`

## Checklist
- [ ] Replace `src/pages/explore/[id].tsx` with a thin redirect component: `useEffect(() => router.replace(\`/sites/\${id}\`))`
- [ ] Replace `src/pages/explore/index.tsx` with redirect to `/sites`
- [ ] Update `AppSidebar.tsx`: change site item hrefs from `/explore/${site.id}` to `/sites/${site.id}`
- [ ] Search codebase for remaining `/explore/` links: `<search_files search_pattern="/explore/" />` — update any found to `/sites/`
- [ ] Verify no dead imports from deleted explore components; keep `src/components/explore/*` components since site-sections may reuse them