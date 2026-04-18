---
title: Split site mega-page into per-section pages (Orders, Products, etc.)
status: todo
priority: urgent
type: chore
tags: [refactor, pages, routing]
created_by: agent
created_at: 2026-04-18T14:15:00Z
position: 33
---

## Notes
The current `src/pages/sites/[id]/index.tsx` is 1934 lines containing ~10 tabs. Extract each tab into its own route. Each new page is thin: imports the section component + wraps in SiteLayout.

**IMPORTANT:** Do NOT rewrite the logic inside each tab. Extract the existing JSX/hooks from the mega-file into section components, then each route renders one section. Preserves all working functionality.

**Migration plan:**
1. Create `src/components/site-sections/` directory
2. For each existing Tab, extract its content into a component: `OrdersSection.tsx`, `ProductsSection.tsx`, `CustomersSection.tsx`, `CategoriesSection.tsx`, `TagsSection.tsx`, `CouponsSection.tsx`, `SyncSection.tsx`, `WebhooksSection.tsx`, `LogsSection.tsx`, `HistorySection.tsx`, `ArchiveSection.tsx`, `SettingsSection.tsx`
3. Create page files that render each section wrapped in SiteLayout
4. Task-32 (Home page) already replaced `[id]/index.tsx` — the old tab content lives in these new sections

**File size rule:** If any extracted section exceeds 300 lines, split further into sub-components in the same folder.

## Checklist
- [ ] Create `src/components/site-sections/` directory structure
- [ ] Audit current `sites/[id]/index.tsx` — list each Tab content block and its dependencies (state, effects, helpers)
- [ ] Extract Orders tab → `OrdersSection.tsx` + create `src/pages/sites/[id]/orders.tsx`
- [ ] Extract Products tab → `ProductsSection.tsx` + create `src/pages/sites/[id]/products.tsx`
- [ ] Extract Customers tab → `CustomersSection.tsx` + create `src/pages/sites/[id]/customers.tsx`
- [ ] Extract Categories tab → `CategoriesSection.tsx` + create `src/pages/sites/[id]/categories.tsx`
- [ ] Extract Tags tab → `TagsSection.tsx` + create `src/pages/sites/[id]/tags.tsx`
- [ ] Extract Coupons tab → `CouponsSection.tsx` + create `src/pages/sites/[id]/coupons.tsx` (stub if doesn't exist yet)
- [ ] Extract Sync tab → `SyncSection.tsx` + create `src/pages/sites/[id]/sync.tsx`
- [ ] Extract Webhooks tab → `WebhooksSection.tsx` + create `src/pages/sites/[id]/webhooks.tsx`
- [ ] Extract Logs tab → `LogsSection.tsx` + create `src/pages/sites/[id]/logs.tsx`
- [ ] Extract History tab → `HistorySection.tsx` + create `src/pages/sites/[id]/history.tsx`
- [ ] Extract Archive tab → `ArchiveSection.tsx` + create `src/pages/sites/[id]/archive.tsx`
- [ ] Extract Settings tab → `SettingsSection.tsx` + create `src/pages/sites/[id]/settings.tsx`
- [ ] Each page wraps section in `<SiteLayout>`, guards with AuthGuard + permission check
- [ ] If any section file exceeds 300 lines, split into sub-components