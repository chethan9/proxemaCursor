---
title: Projects page toolbar + view modes + filters
status: done
priority: high
type: feature
tags: [ui, projects, scale]
created_by: agent
created_at: 2026-04-22
position: 134
---

## Notes

Scale-ready Projects page (`src/pages/projects/index.tsx`). Current version loads all sites in a single list with no density control, which breaks at 100s of sites.

**Layout changes:**
- Remove the "Projects" heading + "Manage WooCommerce store connections and sync status" subheading entirely
- Lift the table up so it starts near the top of the main area
- Move the "Add Site" button into the table toolbar, right-aligned alongside the search + filters
- Keep existing search input, promote to the table toolbar

**View modes** (reuse the pattern from `src/components/explore/shared/ViewModeToggle.tsx` and ProductsTab):
- **List** (current row layout — unchanged)
- **Grid** (card layout — covered in task 135)
- **Compact** (single-line dense rows: favicon + name + URL + client + status pill + health + last sync + quick actions)

Persist view mode per user via `useViewPreferences` (key: `projects-view-mode`).

**Filters in the toolbar:**
- Client dropdown (multi-select, pulls from `clients` table, shows counts per client)
- Status filter (Connected / Partial / Disconnected / Never synced)
- Health filter (Healthy ≥80 / Warning 50-79 / Critical <50)
- Sort dropdown (Name A-Z, Last sync newest/oldest, Health high/low, Created newest/oldest)
- Active filter chips row under toolbar with "Clear all"

**Pagination:** Switch to page-based pagination (50 per page) or infinite scroll. Don't render all rows for super admin with 100s of sites.

**Bulk selection:**
- Checkbox column in list/compact views
- When ≥1 selected, show floating action bar: Sync selected / Export CSV / Clear selection
- Count badge ("N sites selected")

**Must preserve (do not regress during redesign):**
- `IncompleteOnboardingPrompt` (app-level "Resume site setup?" dialog) continues to render and navigate to `/sites/connect/{id}?resume=1`
- The "Resume setup" row action on sites where `onboarding_completed_at` is null must remain accessible in all three view modes (list/grid/compact) — not just list
- The `router.query.wp` / `router.query.store` return handler (WordPress OAuth callback → reopens `EditSiteDialog` focused on that store) stays wired at the page level
- The Lottie cat empty state (when `stores.length === 0`) is retained — show the "Add Site" CTA inside the empty state even though the toolbar button is hidden when empty
- `IncompleteSiteDialog` (opened from SitesTable row for incomplete sites) continues to work — client list, URL validation, update flow
- Existing `useStores` / `useClients` query keys and invalidation on site add/edit/delete keep working

## Checklist

- [ ] Remove page heading + subheading; lift table container to top of main area with comfortable top padding only
- [ ] Move "Add Site" button into the toolbar row (right-aligned, after filters)
- [ ] Add view mode toggle (List / Grid / Compact) persisted via `useViewPreferences`
- [ ] Implement Compact view: 1-line rows with favicon, name, URL, client chip, status pill, health score, last sync, inline edit/open actions
- [ ] Add Client multi-select filter pulling from `clients` table, with count badges per option
- [ ] Add Status filter (Connected / Partial / Disconnected / Never synced) deriving from `consumer_key` + `wp_username` + sync history presence
- [ ] Add Health filter (≥80 / 50-79 / <50) reading `health_score` from `src/lib/health-score.ts`
- [ ] Add Sort dropdown: Name, Last sync, Health, Created
- [ ] Active filters chip row with per-chip remove + "Clear all"
- [ ] Paginate list (50 per page) with page controls; show "Showing 1-50 of N"
- [ ] Bulk selection: checkbox column + floating action bar with "Sync selected" and "Export CSV"
- [ ] Empty state when filters match 0 sites ("No sites match these filters — clear filters")

## Acceptance

- Projects page with 3 sites looks clean and compact; no wasted heading space
- Client filter narrows the list immediately; count badges update per filter combo
- Switching view modes persists across reload
- Selecting 5+ sites shows a bulk action bar with "Sync selected" that enqueues syncs for each