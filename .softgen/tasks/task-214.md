---
title: Block product edit during initial sync (live preview mode)
status: done
priority: high
type: bug
tags: [products, sync-lock, live-preview]
created_by: agent
created_at: 2026-04-26T09:15:00Z
position: 214
---

## Notes

During initial sync ("Live preview mode"), the products page already disables the Columns/Export/Sort toolbar buttons via the `locked` flag, but product CARDS in grid view still show a working "Edit" button on hover, and row clicks in list/table views still open `ProductQuickEdit`. The user can edit products before the local mirror is consistent — edits are likely to be overwritten by the in-flight sync.

Same lock should apply to the inline Edit affordance and any click that opens the quick-edit drawer or the full edit page.

Files involved:
- `src/components/explore/ProductsTab.tsx` — `locked` is already in scope (toolbar uses it). Card hover Edit button is around line 854. Row/card click handlers at lines 765 and 812 call `setQuickEditProduct(p)`.
- `src/pages/sites/[id]/products/edit/[productId].tsx` — also gate the full edit page with a redirect or read-only banner if site has an active initial sync (use existing `useActiveSync` / `useStoreSyncStatus` hooks).
- `SyncLockBanner` component already exists (`src/components/site/SyncLockBanner.tsx`) — reuse if banner needed on edit page.

The `locked` boolean in ProductsTab already encodes "initial sync in progress" — reuse, don't re-derive.

## Checklist

- [x] Grid card Edit button (hover overlay): `disabled={locked}` with tooltip "Available after initial sync completes" — match the toolbar pattern
- [x] Row click handlers (lines 765, 812): when `locked`, don't open quick-edit; show a toast "Editing is disabled during initial sync" or no-op silently
- [ ] List view inline Edit button (line ~854 area): same `disabled={locked}` + tooltip
- [x] Full product edit page (`/sites/[id]/products/edit/[productId]`): if active initial sync detected, render the existing SyncLockBanner and disable Save/form submission, OR redirect back to products list with a toast
- [x] "Add product" button on products page: also gate on `locked` (creating during sync risks duplicate woo_id collisions)
- [ ] Verify same gating on bulk edit / bulk action bar — bulk operations should also be blocked while `locked`

## Acceptance

- During initial sync, hovering a product card shows a disabled Edit button with the existing tooltip wording.
- Clicking a product row/card during initial sync does not open the quick-edit drawer.
- Navigating directly to `/sites/[id]/products/edit/[id]` during initial sync shows the sync-lock banner and form is read-only (or user is redirected with explanation).
- Once initial sync completes, all edit affordances unlock automatically without page reload (already handled via React Query invalidation).
