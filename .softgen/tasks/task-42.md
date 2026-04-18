---
title: Refactor projects/index.tsx into modular components
status: done
priority: high
type: chore
tags: [refactor]
created_by: agent
created_at: 2026-04-18
position: 42
---

## Notes
File is 685 lines. Pure extraction, no behavior changes.

Extract into `src/components/projects/`:
- ProjectCard.tsx — individual site card with health, counts, status badges
- ProjectFilters.tsx — search + status + client filter bar
- CreateProjectDialog.tsx — new site creation dialog
- ProjectsGrid.tsx — grid/list wrapper with empty state

Page becomes thin orchestrator under 300 lines.

## Checklist
- [x] Extract AddSiteDialog to src/components/project/AddSiteDialog.tsx
- [x] Extract EditSiteDialog to src/components/project/EditSiteDialog.tsx
- [x] Extract SitesTable to src/components/project/SitesTable.tsx
- [x] Rewrite src/pages/projects/index.tsx (<300 lines)
- [x] check_for_errors