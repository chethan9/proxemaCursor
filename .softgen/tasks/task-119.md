---
title: Rework Health/Dashboard page — empty states + UI polish
status: done
priority: high
type: feature
tags: [dashboard, ux, design]
created_by: agent
created_at: 2026-04-21T17:10:00Z
position: 119
---

## Notes
The current Health page (`src/pages/index.tsx`) shows charts, logs and reports combined for everyone — including brand-new users who haven't added a site yet. It feels noisy and the donut chart has alignment/overflow problems (labels like "ssful 94%" get cut off). Rework the page end-to-end.

Key data sources already in use: `useStores`, `useClients`, `useSyncRuns`. Reuse them.

Design direction:
- **Empty state first**: when the user has ZERO sites, show a clean, welcoming hero ("Welcome to Proxima — add your first site to start monitoring") with a single primary CTA button routing to `/projects`. Do NOT render any charts, KPI cards, or recent-activity lists in this state.
- **Partial state**: when sites exist but there are no sync runs yet, show only the KPI cards relevant to sites (Active Sites, Fleet Health) and a friendly "No sync data yet — syncs will appear here once triggered" card in place of charts.
- **Full state**: only when sync runs exist, show charts + timeline + recent activity.
- Maintain a clear visual hierarchy: section headings, consistent card padding, generous spacing.

Chart / layout fixes:
- Donut chart: move labels outside the ring OR replace label-on-slice with a centered total (e.g. total syncs, success rate %) and move slice breakdown to the legend below. No more truncated "ssful" text.
- Ensure all charts are fully responsive and text never overflows container.
- Align the three KPI cards on one row at lg breakpoint; stack cleanly on mobile.
- Use the app's design tokens (--primary, --success, --destructive, --muted) instead of hardcoded hex when possible; where hex is needed for chart slices, keep them consistent across all charts.
- "Sites Needing Attention" stays but only renders when attentionStores > 0.

Content adjustments:
- Remove the "v1.0.0 / Build 2026.04.18" version stamp from this page (it doesn't belong on a dashboard).
- Page title + description should adapt to the state (empty vs populated).

## Checklist
- [ ] Empty state: when no sites exist, render only a welcome hero with brief copy + "Add your first site" CTA linking to `/projects`; hide all charts, KPIs, and recent-activity sections.
- [ ] Partial state: sites exist but no sync runs → show Active Sites + Fleet Health KPI cards, hide chart cards, show a "No sync data yet" placeholder card.
- [ ] Full state: all KPI cards, Sync Status donut, Syncs by Data Type bar chart, Timeline line chart, Recent Sites, Recent Sync Runs.
- [ ] Fix donut chart: center the success-rate % inside the ring, move breakdown to legend, eliminate label overflow/truncation.
- [ ] Ensure bar chart + line chart + donut are fully responsive with no cut-off text at any breakpoint.
- [ ] KPI cards: consistent sizing, one row on lg, clean 2-col on md, single column on mobile.
- [ ] Remove the version/build stamp from the dashboard header.
- [ ] "Sites Needing Attention" card renders only when there is at least one site with health < 80.
- [ ] Recent Sites and Recent Sync Runs sections only render when they have data.

## Acceptance
- Brand new user (no sites) sees a single welcome hero with an "Add site" CTA — no charts or logs.
- User with sites but no syncs sees KPI cards + a friendly "no sync data" message, no charts.
- User with full data sees polished charts with no truncated labels, donut shows success rate in the center.
