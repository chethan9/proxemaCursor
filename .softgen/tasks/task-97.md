---
title: Defer variations sync + ring progress + sync indicator line
status: done
priority: high
type: feature
tags: [sync, ui, sidebar, progress]
created_by: agent
created_at: 2026-04-20
position: 97
---

## Notes

Three changes, all UX / sync-ordering polish.

### 1. Variations sync runs LAST

Today `variations` runs right after `products` in `syncFunctions` order (`src/pages/api/stores/[storeId]/sync.ts`). Because variations fan out (one Woo paginated call per variable product), it dominates total sync time and delays every other aspect's progress — products already exist in DB but the run stays "in progress" while variations chew through.

Fix: reorder so `variations` is the FINAL aspect. Order becomes:
`products → orders → customers → categories → tags → coupons → variations`

Products become browsable immediately (they upsert during the products aspect). Variations backfill in the background; edit page already has a `?refresh=1` fallback for any variable product opened before its variations synced.

Check both:
- `syncFunctions` map insertion order in `src/pages/api/stores/[storeId]/sync.ts`
- Default aspect list wherever the API decides which aspects to run (same file, `aspects` destructure from body) — ensure when client sends no aspects we default to this new order
- `src/pages/api/cron/sync-scheduler.ts` aspect list

### 2. Ring progress around sidebar site percentage

Current: plain "25%" text next to site name in `src/components/layout/AppSidebar.tsx`.
Target: SVG circular ring wrapping the percentage value (like the "49%" download example). Ring = 20–24px, stroke ~2.5px, uses `--primary` for progress arc and `--muted` for track. Percent text centered inside, `text-[10px] font-semibold`.

Replace the existing percent badge with a small ring component. Keep the logic that computes the percentage (already wired through `useAllActiveSyncs`).

Hide ring when no active sync (back to nothing, not 0%).

### 3. Animated moving line below active site menu

When a site has an active sync, render a 2px tall horizontal bar DIRECTLY below that site's row in the sidebar showing a shimmering animated gradient (think an indeterminate progress bar — gradient slides left→right infinitely).

Implementation: a thin `div` with a linear-gradient background, animated via Tailwind keyframes (`@keyframes shimmer` translating background-position). Colors: subtle — `from-transparent via-primary to-transparent`, ~1.5s loop.

Only show when `isActive` for that site. Place it as the last child of the active site's sidebar item / menu group.

## Checklist

- [ ] Reorder `syncFunctions` in `src/pages/api/stores/[storeId]/sync.ts` so `variations` runs last
- [ ] Update default aspects list (when client omits aspects) to match new order
- [ ] Update `src/pages/api/cron/sync-scheduler.ts` aspect ordering to match
- [ ] Replace plain percent text in `AppSidebar.tsx` with circular SVG ring + centered percent (hidden when no active sync)
- [ ] Add shimmering horizontal line under the active site's menu when sync is in progress (uses `@keyframes shimmer` in globals.css)
- [ ] Verify `useAllActiveSyncs` / `useActiveSync` already expose enough state (isActive + percent) — reuse, don't add new queries

## Acceptance

- Starting a full sync: products appear in the Products tab within seconds; variations count keeps climbing in sync-runs page while everything else already completed
- Sidebar site row shows a clean ring around "25%" during sync, ring fills as progress advances, disappears when sync ends
- A thin animated line shimmers under the active site's menu while syncing, vanishes on completion