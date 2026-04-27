---
title: Pending-operation lock + in-flight save freeze (concurrency safety)
status: todo
priority: high
type: feature
tags: [products, orders, bulk-jobs, ux, safety]
created_by: agent
created_at: 2026-04-27T00:30:00Z
position: 238
---

## Notes

Two related concurrency gaps to close:

### Problem A — Stale UI during async bulk jobs
Today, when a user clicks "Delete" on a product (single or bulk), the action is enqueued in `bulk_jobs` and the `process-bulk-jobs` cron picks it up seconds–minutes later. During that window the product still looks editable in the UI. The user can:
- Open it and edit fields → save → conflicts with the pending delete
- Include it in another bulk action (e.g. bulk price update) → second job races the first
- See it in product cards / data explorer with no indication it's queued

Same problem for orders (bulk status change → "completed") and any future bulk mutation.

**Fix:** Add lightweight pending-action columns on the mirror tables, set the moment a bulk job is enqueued, clear when the job finishes. Make the UI honor them everywhere the entity is rendered.

Affected tables (start): `products`, `orders`. Future: `customers`, `coupons`.

New columns per affected table:
- `pending_action TEXT NULL` (e.g. `delete`, `status_change`, `price_update`, `category_assign`)
- `pending_job_id UUID NULL` (FK to `bulk_jobs.id`, no cascade — keep audit trail if job row is purged)
- `pending_at TIMESTAMPTZ NULL`

Index on `(pending_action) WHERE pending_action IS NOT NULL` per table for fast filter.

Wire-in points (server):
- `src/services/bulkJobService.ts` `createBulkJob` (or wherever items are enqueued) → after the job row is inserted, run a single UPDATE on the affected entity table setting pending_action/pending_job_id/pending_at for every entity_id in the job payload.
- `src/pages/api/cron/process-bulk-jobs.ts` → on each item completion (success OR fail), clear the three pending_* columns. On final job status set, sweep any remaining locked rows for that job_id.
- New cron task or extension of `auto-fail-stuck.ts` → clear pending locks older than 30 minutes whose `bulk_jobs.status` is `completed`/`failed`/`canceled` (safety net for race conditions).

Wire-in points (client):
- `src/services/productService.ts` + `orderService.ts` queries already select `*` — verify the new columns flow through.
- Single product/order row renderers (`ProductsTab`, `OrdersTab`, `GridSiteCard` analogues, `ProductRowExpanded`, `OrderRowExpanded`, edit pages) → when `pending_action` is set, render at 50% opacity with a small pill: `Scheduled: delete` / `Scheduled: status → completed` / etc. Replace edit/action affordances with a disabled state. Click → toast: `"This product is queued for {action}. It'll be available once the job finishes."`
- Bulk action toolbars (`ProductsTab` BulkActionBar, `OrdersTab` equivalent) → on selection, exclude locked rows from the actionable set. Show inline notice: `"3 items skipped — already pending other operations"`. Don't allow re-queuing.
- Edit pages (`src/pages/sites/[id]/products/edit/[productId].tsx`, `orders/[orderId].tsx`, `customers/[customerId].tsx`) → on load, if `pending_action` is set, render the existing sync-locked banner pattern with a tailored copy explaining the queued action; hide the form.
- Realtime: if RecentMutationsProvider or react-query polling already invalidates after job completion, locks will clear naturally on next refetch. Verify `useProducts`/`useOrders` invalidate after `useBulkJobs` completion (likely via `useSyncCompletionInvalidation` analog — may need a new `useBulkJobCompletionInvalidation`).

Single-row mutations that route through bulk-jobs (e.g. single delete from product cards / detail page) inherit the same lock automatically because they go through the same `createBulkJob` path.

### Problem B — In-flight save races
On product add/edit, after clicking Save, the request takes 3–5 seconds (Woo round-trip + DB upsert). During that time the user can navigate away, open another product, click bulk actions, etc. — all of which can produce inconsistent state.

**Fix:** Add a global "blocking save" overlay. When a critical save mutation is in flight, freeze the entire viewport with a translucent overlay + spinner + label (`"Saving product…"`). All clicks/keystrokes consumed by the overlay (focus trap). Browser-level `beforeunload` handler also active during this window.

Reuse existing `src/contexts/LoadingProvider.tsx` if the API is already there; otherwise extend it. The hook usage looks like:
```
const { withBlockingSave } = useBlockingSave();
const save = useSiteMutation({ mutationFn: () => withBlockingSave("Saving product…", () => updateProduct(...)) });
```

Affected save flows (must wrap):
- Product create (`src/pages/sites/[id]/products/new.tsx`)
- Product edit (`src/pages/sites/[id]/products/edit/[productId].tsx`)
- Order edit (status/notes/customer changes — `src/pages/sites/[id]/orders/[orderId].tsx`)
- Customer create + edit
- Category/tag dialog saves (`src/components/explore/TaxonomyDialog.tsx`)

The existing `saving` prop on each editor already disables the local Save button — keep that. The overlay is an additional layer that prevents *navigation* and *other actions* during the save window, not just the local button.

### Acceptance copy & UX

Locked product card pill: `Scheduled: delete` (rose-tinted, small).
Locked order pill: `Scheduled: → completed`.
Toast on locked-row click: `This {entity} is queued for {action}. It'll be available once the job finishes.`
Save overlay: centered card with spinner + `Saving product…` (or context-specific label) + subtle warning `Don't close this tab.`
Bulk action skip notice: `{N} items skipped — already pending other operations.`

## Checklist

- [ ] Add `pending_action`, `pending_job_id`, `pending_at` columns + partial indexes on `products` and `orders` via a new migration; types regenerate automatically.
- [ ] Update `bulkJobService.createBulkJob` (server-side, or the API route that enqueues) to UPDATE the affected entity rows with pending_* values atomically with the job insert (single transaction).
- [ ] Update `src/pages/api/cron/process-bulk-jobs.ts` to clear pending_* on each item complete + final job status; extend `auto-fail-stuck.ts` (or add a new sweep) to clear orphan locks older than 30 minutes when their job is in a terminal state.
- [ ] Render locked state in `ProductsTab` (list, grid, table views) + product edit page: 50% opacity, status pill, edit affordances disabled, click → toast.
- [ ] Render locked state in `OrdersTab` + order edit page with order-specific pill copy.
- [ ] Update bulk action toolbars to filter out locked rows from selection; show "{N} skipped" notice when applicable.
- [ ] Add realtime/invalidation hook so locked rows un-grey within ~2s after the bulk job completes (extend or mirror `useSyncCompletionInvalidation` for bulk jobs).
- [ ] Extend `LoadingProvider` (or add a `BlockingSaveProvider`) with a full-screen overlay that blocks pointer events + key events + browser navigation (`beforeunload`) while a save mutation is in flight. Centered card with spinner + contextual label + "Don't close this tab" copy.
- [ ] Wrap save mutations in product create + edit, order edit, customer create + edit, and taxonomy dialog with the blocking-save helper.
- [ ] Document the lock contract in `docs/KNOWN_TRAPS.md` so future bulk-action features remember to wire pending_* on enqueue.

## Acceptance

- Selecting a product and clicking Delete → product card immediately greys out with "Scheduled: delete" pill, before the bulk job even runs. Clicking the card shows a toast explaining it's queued.
- While a delete is pending, that product is excluded from any new bulk selection and the bulk action toolbar shows "1 item skipped — already pending other operations".
- Clicking Save on the product edit page locks the entire viewport with a "Saving product…" overlay; sidebar, navigation, and other product cards are non-interactive until the response returns.
- After ~30 minutes if a bulk job's pending_* columns weren't cleared (e.g. process crashed), the safety-net cron unlocks them so the UI doesn't get stuck.