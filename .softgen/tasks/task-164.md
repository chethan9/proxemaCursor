---
title: Row-level sync status pill (Saving / Saved / Syncing to Woo)
status: todo
priority: high
type: feature
tags: [ux, status, webhooks, data-freshness]
created_by: agent
created_at: 2026-04-23T05:50:10Z
position: 3
---

## Notes
Layer 3. Even with write-through (task-162) and cache invalidation (task-163) in place, there's still a silent window where the user saved something, the server says OK, but they wonder "did it really sync to my live store?" This task adds a visible, per-row status indicator so the state is never ambiguous.

Three states per recently-mutated row:
1. **Saving…** — mutation in flight (spinner pill)
2. **Saved** — server responded 2xx; show for ~2s then fade
3. **Syncing…** — edge case: our write succeeded but something about the Woo response looked incomplete, or user is watching a row that was updated via webhook just now. Show a subtle pulsing pill that clears on next webhook reconciliation

Place the pill:
- Inline at the end of the affected row in `ProductsTab.tsx`, `OrdersTab.tsx`, `TaxonomyTab.tsx`, customer table on `sites/[id]/customers.tsx`
- In the detail page header on `sites/[id]/orders/[orderId].tsx`, `sites/[id]/customers/[customerId].tsx`, product edit pages — next to the entity title

Driven by:
- Local "recently mutated" set keyed by entity id, populated by `useSiteMutation` (task-163) via a lightweight context/store in `src/contexts/` or zustand-lite. Entries auto-expire.
- For webhook reconciliation state: subscribe to `entity_changes` via Supabase realtime filtered by `store_id` and `source IN ('webhook', 'sync')`, with a short TTL window after a dashboard write. Fallback: poll `entity_changes` by `entity_id` for 15s after mutation if realtime is unavailable.

Reuse the existing `src/components/ui/status-badge.tsx` styling vocabulary for visual consistency.

**Scope boundary:** this is view-layer only. It does not retry, does not block editing, does not replace toasts (task-165). It's a passive indicator.

## Checklist
- [ ] Create a `RecentMutationsProvider` context in `src/contexts/` that tracks `{ entityType, entityId, state: 'saving'|'saved'|'syncing', ts }[]` with auto-expiry (saved: 2s, syncing: 15s)
- [ ] Wire `useSiteMutation` (task-163) to push state transitions into the context on mutate/success/error
- [ ] Build a `SyncPill` component in `src/components/ui/sync-pill.tsx` reading from the context by `{entityType, entityId}`
- [ ] Add realtime subscription to `entity_changes` (or short-window polling) to detect webhook reconciliation and clear 'syncing' state
- [ ] Drop `SyncPill` into product rows in `ProductsTab.tsx`
- [ ] Drop `SyncPill` into order rows in `OrdersTab.tsx` and order detail header
- [ ] Drop `SyncPill` into category/tag rows in `TaxonomyTab.tsx`
- [ ] Drop `SyncPill` into customer rows and customer detail header
- [ ] Drop `SyncPill` into product edit page header
- [ ] Pill visuals: spinner + muted text for saving, green check + "Saved" for saved, pulsing dot + "Syncing to [site]" for syncing

## Acceptance
- Editing a product from the list shows a "Saving…" pill on that row, transitions to "Saved" for ~2s, then fades
- If an incoming webhook updates a different product while the user is on the list, that row briefly shows a "Syncing…" pill
- Pills never persist across refresh (they're ephemeral client state, not DB-backed)
