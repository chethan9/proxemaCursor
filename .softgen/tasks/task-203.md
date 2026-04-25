---
title: Keyboard shortcuts for explorer tabs (Cmd+K + arrow nav)
status: done
priority: medium
type: feature
tags: [ux, keyboard, productivity]
created_by: agent
created_at: 2026-04-25T23:50:00Z
position: 203
---

## Notes

Power-user keyboard shortcuts on Products/Orders/Taxonomy explore tabs:
- **⌘K / Ctrl+K** focuses the search input (selects existing text)
- **Left arrow** previous page; **Right arrow** next page (only when not typing in an input/textarea, no modifier keys)

Single shared hook `useExplorerKeyboard` keeps behavior identical across tabs.

## Checklist

- [x] Create `src/hooks/useExplorerKeyboard.ts` — handles ⌘K focus + arrow pagination, ignores typing context
- [x] Wire into ProductsTab — searchRef + onPrev/onNext + ⌘K kbd hint in input
- [x] Wire into OrdersTab — same
- [x] Wire into TaxonomyTab — same
- [x] kbd hint visible only when search empty (no overlap with refetch spinner)

## Acceptance

- Pressing ⌘K (Mac) / Ctrl+K (Win) on any explorer tab focuses the search field
- Pressing Left/Right arrows (when not typing) navigates pagination
- Arrow keys ignored when focused in an input, textarea, or with modifiers