---
title: Create site Home (analytics) page with coming soon
status: todo
priority: high
type: feature
tags: [pages, analytics]
created_by: agent
created_at: 2026-04-18T14:15:00Z
position: 32
---

## Notes
New landing page when user enters a site. Replaces the current mega-tabs `/sites/[id]` as the default view. Shows "Analytics — coming soon" placeholder per user direction; detailed analytics will be a future task.

**Route:** `/sites/[id]` (the existing index.tsx will be repurposed — see task-33 for migration)

**Content (minimal):**
- Page header: site name + status badge + site URL
- Quick stats row: 4 cards (Products, Orders, Customers, Last sync) — use existing data already loaded by services
- Large empty state card: "Analytics coming soon" — icon + heading + muted description ("Detailed analytics and insights for this site will appear here")
- Wrapped in SiteLayout

## Checklist
- [ ] Replace content of `src/pages/sites/[id]/index.tsx` with new Home page: site header + 4 stat cards + analytics coming soon empty state
- [ ] Wrap page in `<SiteLayout>` from task-31
- [ ] Reuse existing stat queries from storeService/productService/orderService for the count cards
- [ ] Use existing EmptyState component for the analytics placeholder with Sparkles or BarChart3 icon
- [ ] Ensure page guards: AuthGuard + permission check (sites_view)