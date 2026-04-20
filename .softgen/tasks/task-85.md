---
title: Robust sync visibility + celebration
status: in_progress
priority: urgent
type: feature
tags: [sync, ux, realtime]
created_by: agent
created_at: 2026-04-20
position: 0
---

## Notes
Sync celebration must survive logout/tab close. Add DB-backed completion tracking, global watcher, sidebar progress %, sync-aware empty states, and realtime auto-refresh.

## Checklist
- [ ] Add stores.initial_sync_completed_at + celebration_shown_at columns
- [ ] sync.ts: stamp initial_sync_completed_at on initial sync completion
- [ ] Create SyncCelebrationWatcher component (global, in AppLayout)
- [ ] Mount watcher in AppLayout, remove old per-page celebration from SyncProgressBanner
- [ ] AppSidebar: show live % next to site name when actively syncing
- [ ] Sync-aware empty states in OrdersTab, ProductsTab, TaxonomyTab
- [ ] Realtime refetch: invalidate queries when sync_runs or stores row updates