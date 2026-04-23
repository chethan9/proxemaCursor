---
title: Virtualize Orders table rows for large datasets
status: todo
priority: high
type: feature
tags: [performance, tables, orders]
created_by: agent
created_at: 2026-04-23
position: 180
---

## Notes
Orders table is the heaviest surface in the app — rich rows with status badges, customer name, phone, item count, payment title, date, and an expandable detail panel (OrderRowExpanded is 315 lines). Rendering 500+ rows already costs ~0.5-1.5s first paint and noticeable scroll stutter. Rendering 1000+ will feel bad without virtualization.

Fix: add row virtualization via `@tanstack/react-virtual` (already a sibling of the TanStack ecosystem used by React Query). Render only the ~20 rows in the viewport; off-screen rows exist in data but not in DOM. Unlocks 1000, 2500, 5000 rows/page feeling instant.

**Key constraints to preserve** (don't break existing UX):
- Expandable rows: clicking a row expands it inline with `OrderRowExpanded`. Virtualizer must support variable row heights (expanded = tall, collapsed = short).
- Sticky column header with sort arrows + column-reorder handles
- Column resize / reorder behavior
- Row hover state, selection checkboxes (if present)
- Keyboard navigation between rows still works
- Export button exports the full filtered set, not just visible rows

**Libs:** use `@tanstack/react-virtual` — it supports dynamic row heights via `measureElement` ref callback, which is what we need for expand/collapse.

Scope this task to **Orders table only**. Products and Customers stay as-is for now — if they become pain points they get their own task following this pattern.

## Checklist
- [ ] Install `@tanstack/react-virtual` (verify React 18 compatible version)
- [ ] Refactor `src/components/explore/OrdersTab.tsx` row rendering to use `useVirtualizer` with dynamic `measureElement` for variable-height rows (collapsed vs expanded)
- [ ] Preserve sticky header with sort, column visibility menu, column reorder — header sits above the virtualized body
- [ ] Preserve expand/collapse: clicking a row toggles `OrderRowExpanded` inline; virtualizer remeasures so layout flows correctly
- [ ] Preserve all existing filters (Payment / Date / Total), search, sort — they filter/sort the data array the virtualizer reads from
- [ ] Preserve Export button behavior — exports the full filtered dataset, not just visible rows
- [ ] Preserve pagination — virtualizer operates within the current page (e.g. 1000 rows), pagination switches pages
- [ ] Verify scrolling 1000+ rows is smooth (60fps in Chrome DevTools performance panel)
- [ ] Verify selecting an order → expanding → collapsing → scrolling away and back restores correct state
- [ ] Add 2500 and 5000 to the page-size dropdown on Orders only (post-virtualization these become comfortable)

## Acceptance
- Orders table with 1000 rows loads in <500ms and scrolls at 60fps
- Expanding an order works identically to before (same OrderRowExpanded content, same animation)
- Sort / filter / search / export all work unchanged
- Page-size dropdown on Orders table offers up to 5000; stays smooth at 5000