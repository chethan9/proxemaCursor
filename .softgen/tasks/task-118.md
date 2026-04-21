---
title: Projects row click opens site home + reports icon action
status: done
priority: high
type: feature
tags: [projects, ux]
created_by: agent
created_at: 2026-04-21T17:10:00Z
position: 118
---

## Notes
Two small UX upgrades on the Projects listing (`src/pages/projects/index.tsx` → `src/components/project/SitesTable.tsx`).

1. Clicking anywhere on a project row (except on action buttons/icons) should navigate the user to `/sites/[id]/home`. Currently rows are not clickable — users have to use the Edit menu. Make the row cursor-pointer and keyboard-accessible.
2. Next to the existing Edit action in each row, add a second icon-button using a "reports" style icon (e.g. `BarChart3` or `LineChart` from lucide-react — pick the one that reads clearest as "reports/analytics"). Clicking it opens `/projects/[id]` (the existing project detail/reports page). Tooltip: "View reports".

Behavior details:
- Row click must NOT fire when the click originates from the Edit button, the new Reports icon, status badges that link elsewhere, or any other interactive control in the row (stop propagation on those).
- Keyboard: row should be focusable and Enter should trigger navigation.
- Reports icon should sit immediately before (or after) the Edit action, same size, same hover treatment.

## Checklist
- [ ] Make each project row in the Projects listing clickable; clicking the row navigates to `/sites/[id]/home`.
- [ ] Prevent row navigation when the click originates from an in-row action (Edit, new Reports icon, any menu triggers).
- [ ] Add a Reports icon button in the row actions area, placed next to Edit, with a "View reports" tooltip, routing to `/projects/[id]`.
- [ ] Ensure row is keyboard-accessible (focusable, Enter activates navigation) and cursor changes to pointer on hover.

## Acceptance
- Clicking a row's site name / empty area of the row opens `/sites/[id]/home`.
- Clicking the new Reports icon opens `/projects/[id]` without triggering the row navigation.
- Clicking Edit still opens the Edit dialog without triggering the row navigation.
