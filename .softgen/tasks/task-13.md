---
title: Redesign Sync Engine UI + add sync test / dry-run feature
status: done
priority: medium
type: feature
tags: [sync, ui, dry-run]
created_by: agent
created_at: 2026-04-17
position: 13
---

## Notes
Sync UI redesigned with unified progress bar, cancel button, and auto-timeout. Dry-run endpoint deferred as future enhancement.

## Checklist
- [x] Redesign Sync Engine tab: stat tiles with count + last sync time
- [x] Add action bar: Sync All Data button + Cancel Sync button
- [x] Unified progress bar during sync showing aspect progress
- [x] Fix blinking: polling-based refresh during active sync only
- [x] Add manual cancel via PATCH endpoint
- [x] Add auto-timeout for stuck syncs (>10 min)
- [ ] Create POST `/api/stores/[storeId]/sync-test` dry-run endpoint (deferred)
- [ ] Show dry-run results dialog (deferred)
- [ ] Aspect dropdown for single-aspect sync (deferred)
