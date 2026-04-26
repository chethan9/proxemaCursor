---
title: Global top progress bar
status: done
priority: high
type: feature
tags: [ui, ux, loading]
created_by: agent
created_at: 2026-04-26T01:58:30Z
position: 207
---

## Notes

Replace the per-table `TopProgressBar` (currently `position: absolute` on the table card, defined in `src/components/ui/top-progress-bar.tsx`) with a single global progress bar rendered at the app shell level so it stays visible while scrolling.

**Visual spec:**
- Color: success green (use `--success: 142 76% 36%`), not primary blue.
- Thickness: ~3px (thicker than current 2px) so it reads clearly across the viewport.
- Animated indeterminate slide (keep existing `animate-progress-slide` style, just retinted green).
- Positioned `fixed` at the very top of the viewport, above the top navbar/sidebar (highest z-index), full width edge-to-edge.
- Smooth fade in/out (~200ms).

**Architecture:**
- New global loading context/provider (e.g. `LoadingProvider`) mounted in `_app.tsx` / `AppLayout`. Tracks an integer counter so multiple concurrent fetches stack correctly — bar shows while count > 0, hides when 0.
- Expose a hook (e.g. `useGlobalLoading`) that returns `{ start, stop }` plus a convenience `useLoadingEffect(active: boolean)` that wires a boolean (e.g. React Query `isFetching`) to the counter via `useEffect`.
- Render the bar component once inside `AppLayout` so every authenticated page gets it; also include it in public layouts (pricing, auth) so route-level loading is consistent.

**Migration:**
- Remove `TopProgressBar` usages from inside tables (Products, Orders, Customers, Taxonomy, Sync Runs, Webhooks Activity, Bulk Jobs, Subscriptions, etc.). Replace each with a `useLoadingEffect(isFetching)` call so the global bar reflects the same state.
- Keep `TableLoadingOverlay` as-is (the centered "Updating…" pill is still useful for in-table feedback during background refresh).
- Hook into Next.js router events (`routeChangeStart` / `routeChangeComplete` / `routeChangeError`) so navigation between pages also triggers the bar.

**Acceptance check:** scroll a long Orders/Products table while a refetch is happening — the green bar must remain visible at the top of the viewport the entire time.

## Checklist

- [ ] Build global loading provider with concurrent-counter logic and expose `useGlobalLoading` + `useLoadingEffect` hook
- [ ] Update `TopProgressBar` styling to green (success token), ~3px thickness, fixed full-width at viewport top with high z-index
- [ ] Mount provider + bar in app shell so it appears on every page (authenticated and public layouts)
- [ ] Wire Next.js router events to start/stop the bar on route transitions
- [ ] Replace per-table progress bar usages across Products, Orders, Customers, Taxonomy, Sync Runs, Webhooks Activity, Bulk Jobs, Subscriptions tables with `useLoadingEffect(isFetching)`
- [ ] Verify in dark mode the green reads clearly against dark backgrounds

## Acceptance

- Green progress bar at the very top of the viewport remains visible while scrolling any long table during a refetch.
- Bar appears automatically on route transitions and on any registered async fetch.
- No duplicate/per-table progress bars remain; tables still show the centered "Updating…" overlay for in-place feedback.
