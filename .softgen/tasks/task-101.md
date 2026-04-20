---
title: Live data refresh during active sync
status: todo
priority: high
type: bug
tags: [products, orders, taxonomy, sync, realtime]
created_by: agent
created_at: 2026-04-20
position: 101
---

## Notes
Problem: While a sync is running (e.g. "99% complete"), Products / Orders / Categories / Tags pages show an empty syncing state and do NOT progressively load data as rows land in Supabase. Users must manually refresh to see data. We need all data-explorer modules to stream in new rows as the sync progresses, then do a final refresh when sync completes.

Scope: Data Explorer modules only — Products, Orders, Categories, Tags (`src/components/explore/ProductsTab.tsx`, `OrdersTab.tsx`, `TaxonomyTab.tsx`). Sync state comes from `useAllActiveSyncs()` (`src/hooks/queries/useAllActiveSyncs.ts`).

Approach (hybrid — both are needed):
1. **Polling while sync is running** — pass a `refetchInterval` (e.g. 4–5s) into the relevant `useQuery` hooks whenever `activeSync?.running === true` for the current `storeId`. Stop polling when sync completes.
2. **Final invalidation on completion** — watch the running flag; when it transitions from `true → false`, invalidate the module's query keys so stale placeholder data is replaced with fresh server state. Already partially done for products — extend to orders + taxonomy and verify products path.
3. **Empty-state gating** — if `isLoading` AND no cached data AND sync is running, keep the "Syncing your products…" panel. As soon as the first rows arrive, render the grid/list even while sync continues (just show a small "Syncing — more coming" chip). Never block the UI once data exists.

Hook changes:
- `useOrders`, `useProducts`, `useTaxonomyRows` should accept an optional `refetchInterval` option and pass it through to `useQuery`.
- Consumers (`OrdersTab`, `ProductsTab`, `TaxonomyTab`) read `activeSync?.running` and pass `refetchInterval: running ? 5000 : false`.

Completion-invalidation pattern (apply per module):
```ts
const prevRunning = useRef(false);
useEffect(() => {
  const running = !!activeSync?.running;
  if (prevRunning.current && !running) {
    queryClient.invalidateQueries({ queryKey: [<module>, storeId] });
  }
  prevRunning.current = running;
}, [activeSync?.running]);
```

Edge cases:
- Multiple sites — only invalidate/poll for the current `storeId` (already keyed by storeId).
- User switches site mid-sync — previous interval should stop when component unmounts.
- Webhook-only incremental updates (no active sync running) — optional: subscribe to Supabase realtime on `products`/`orders`/`product_categories`/`product_tags` filtered by store_id to pick up webhook-driven rows without a full sync. Stretch goal; polling covers the active-sync case which is the reported pain.

## Checklist
- [ ] Extend `useOrders`, `useProducts`, `useTaxonomyRows` hook signatures to accept and pass through `refetchInterval`
- [ ] `ProductsTab`: pass `refetchInterval: activeSync?.running ? 5000 : false` to `useProducts`; verify existing completion-invalidation covers products + taxonomy
- [ ] `OrdersTab`: wire `useAllActiveSyncs` to derive `activeSync` for current store; pass `refetchInterval` to `useOrders`; add completion-invalidation for `["orders", storeId]`
- [ ] `TaxonomyTab`: wire `useAllActiveSyncs`; pass `refetchInterval` to `useTaxonomyRows`; add completion-invalidation for `["taxonomy", mode, storeId]`
- [ ] Empty-state gating: show "Syncing…" panel only when there is no cached data; once first rows exist, render the grid and show a subtle "Syncing — X% complete" inline chip above the grid
- [ ] Verify on a real sync: rows stream in every ~5s; grid never shows empty once data arrives; final completion triggers one fresh fetch; polling stops afterwards

## Acceptance
- Starting a sync on an empty store: within 5–10s the first rows appear in Products/Orders/Categories/Tags grids while the sync continues, without user interaction.
- When sync reaches 100%, each module does a final refresh and all rows are present.
- When no sync is running, no background polling occurs on these pages.