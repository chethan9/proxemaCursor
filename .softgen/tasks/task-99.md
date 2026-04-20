---
title: Auto-refresh data views when sync completes
status: done
priority: high
type: bug
tags: [sync, ux]
created_by: agent
created_at: 2026-04-20
position: 99
---

## Notes
Currently when a sync finishes, pages like Products/Orders still show the "Syncing your products…" loader until the user manually refreshes. This is because the query for products/orders isn't invalidated when the active-sync record transitions from running → complete. Need to watch that transition and invalidate the relevant queries automatically.

Files involved:
- `src/components/explore/ProductsTab.tsx` — uses `useAllActiveSyncs()` and `useProducts()`
- `src/components/explore/OrdersTab.tsx` — same pattern
- `src/components/explore/TaxonomyTab.tsx` — same pattern
- `src/hooks/queries/useAllActiveSyncs.ts` — source of truth for running state

Approach: in each tab component, track previous `running` state with a ref; when it flips from true → false, call `queryClient.invalidateQueries` for that tab's data key + related lookups (e.g., category options for products).

## Checklist
- [x] Products tab auto-refreshes rows + category filter options when its site's sync completes
- [x] Orders tab auto-refreshes rows when its site's sync completes
- [x] Taxonomy tab (categories + tags) auto-refreshes when sync completes
- [x] No duplicate refetch storms — only invalidate on the running→idle transition, not on every poll
- [x] Loader state clears within 1-2 seconds of sync completion without requiring a manual page refresh

## Acceptance
- Start a fresh sync on a site with empty data; when progress reaches 100% the products grid populates automatically within ~2s
- Same for orders and taxonomy pages — no manual refresh needed