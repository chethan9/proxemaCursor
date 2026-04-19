---
title: Safe site deletion during active sync (abort + cleanup + UI guards)
status: todo
priority: urgent
type: feature
tags: [sync, delete, safety, multi-site]
created_by: agent
created_at: 2026-04-19
position: 0
---

## Notes

Currently deleting a site mid-sync leaves dangling work: cron workers + sync endpoint continue polling WooCommerce for a deleted store, sync_runs rows orphan, and the frontend banner shows a ghost row until the 15-min window expires. Need graceful abort + cleanup + user warning.

### Backend changes

**1. Mark running sync_runs as cancelled before delete** (`src/pages/api/stores/[storeId]/delete.ts`)
Before the final `DELETE FROM stores` call, run:
```sql
UPDATE sync_runs
SET status = 'cancelled', completed_at = NOW(), error_message = 'Store deleted'
WHERE store_id = :storeId AND status = 'running';
```
This runs first so any in-flight worker batch will see the cancellation on next check.

**2. Cancellation check in sync loop** (`src/pages/api/stores/[storeId]/sync.ts` + `src/pages/api/cron/sync-scheduler.ts`)
Inside each per-aspect pagination loop (products, orders, etc.), re-fetch the parent `sync_runs` row between batches. If its status is `cancelled` OR the `stores` row no longer exists → break the loop and skip remaining aspects. This prevents the 5-minute edge function timeout from continuing to hammer a deleted site.

Simplest check: at top of each iteration, `select status from sync_runs where id = :runId` — if not `running`, exit.

**3. Store existence guard in cron scheduler**
Before processing a store's queue, verify the store row still exists. If null → skip and delete orphan sync_runs.

### Frontend changes

**4. Delete confirmation warning** (wherever the delete button lives — likely `src/components/project/SitesTable.tsx` or `src/pages/sites/[id]/settings.tsx`)
Before calling the delete endpoint, check if the store has an active sync (query `useActiveSync(storeId)` or look up in `useAllActiveSyncs` result). If running:
- Show `AlertDialog` with copy: **"This site is currently syncing. Deleting will cancel the sync and remove all local data. This cannot be undone."**
- Only after confirm → call delete endpoint.

If NOT running: existing confirm dialog stands.

**5. localStorage cleanup on successful delete**
After the delete API returns 200, client-side:
```
localStorage.removeItem(`sync-display-progress:${storeId}`)
localStorage.removeItem(`celebrated:${storeId}`)
```

**6. Banner auto-recovery**
Once `useAllActiveSyncs` is in place (task-82), deleted stores disappear from the query result automatically (JOIN with stores). No dangling row needed — happens on next 2s poll. Nothing to add here beyond task-82.

**7. Guard site pages against 404 store**
In `src/components/layout/SiteLayout.tsx` or the `useStores`-hook consumers: if the store fetch returns null (404/deleted), redirect to `/projects` with a toast: *"Site no longer exists."* Prevents dangling tabs after cross-tab deletion.

### Files touched

- `src/pages/api/stores/[storeId]/delete.ts` — add pre-delete UPDATE to cancel running runs
- `src/pages/api/stores/[storeId]/sync.ts` — add cancellation check between batches
- `src/pages/api/cron/sync-scheduler.ts` — check store existence + run cancellation status per iteration
- Delete button location (e.g., `src/pages/sites/[id]/settings.tsx` or `src/components/project/SitesTable.tsx`) — add "sync-in-progress" warning variant to confirm dialog + localStorage cleanup
- `src/components/layout/SiteLayout.tsx` — redirect to `/projects` if store not found, with toast

## Checklist

- [ ] Delete endpoint marks all running `sync_runs` for the store as `status='cancelled'` with error message "Store deleted" BEFORE deleting the store row
- [ ] Per-aspect sync loops in `sync.ts` re-check the parent `sync_runs.status` between pagination batches; exit early if status is no longer `running`
- [ ] Cron scheduler verifies store row exists at start of each store's queue processing; skips and cleans up orphaned runs if deleted
- [ ] Delete confirmation dialog shows a stronger warning variant when the site has an active sync ("This site is currently syncing. Deleting will cancel the sync and remove all local data.")
- [ ] After successful delete, client clears `sync-display-progress:${storeId}` and `celebrated:${storeId}` from localStorage
- [ ] SiteLayout redirects to `/projects` with a toast if the store row is not found (handles cross-tab deletion edge case)

## Acceptance

- Deleting a site during an active sync shows a warning dialog explaining sync will be cancelled
- After confirm, the sync stops within a few seconds (next batch check sees cancellation), the site disappears from the UI, and the banner compact row vanishes on next poll
- No orphan `sync_runs` rows remain in the database for deleted stores
- No WooCommerce API requests continue firing for deleted stores after delete completes
- A user sitting on a page of a site that got deleted from another tab/window is redirected to `/projects` with a clear toast message — no blank/broken page