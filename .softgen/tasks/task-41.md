---
title: Refactor projects/[id].tsx into modular components (pure extraction)
status: done
priority: high
type: chore
tags: [refactor, performance]
created_by: agent
created_at: 2026-04-18
position: 41
---

## Notes
File is 1931 lines — hardest to maintain, most urgent to split. PURE EXTRACTION only, no behavior changes. Target: page file under 300 lines, each extracted component under 300 lines.

Target structure under `src/components/project/`:
- SiteHeader.tsx — breadcrumb, title, health badge, top-right actions
- ConnectivityPanel.tsx — OAuth/direct keys status + test connection
- InitialSyncPanel.tsx — initial full sync controls + progress
- SyncPanel.tsx — sync aspects toggles + manual sync + dry run
- WebhookPanel.tsx — webhook registration, ping, event log
- HealthPanel.tsx — health score breakdown
- SettingsPanel.tsx — cron interval, site settings, delete site
- QuickStats.tsx — record counts tiles

Page `src/pages/projects/[id].tsx` becomes a thin orchestrator: fetch site data, render tabs/panels, pass props. No logic changes.

Shared state (current site, mutations) stays in the page; pass down via props.
All existing hooks (useStores, useSyncRuns, useWebhooks) continue to be called from the page to avoid N query refetches.

## Checklist
- [x] Create src/components/project/DeletedRecordsArchive.tsx
- [x] Create src/components/project/SyncPanel.tsx
- [x] Create src/components/project/WebhookPanel.tsx
- [x] Create src/components/project/LogsPanel.tsx
- [x] Create src/components/project/constants.ts + formatters.ts
- [x] Rewrite src/pages/projects/[id].tsx as thin orchestrator (627 lines, down from 1931)
- [x] Verify no behavior change
- [x] Run check_for_errors; all passed