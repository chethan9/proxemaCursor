---
title: Standardized mutation hook with auto-invalidation and optimistic updates
status: done
priority: urgent
type: feature
tags: [ux, mutations, react-query]
created_by: agent
created_at: 2026-04-23
position: 2
---

## Notes
Layer 2 and the **single biggest cause** of the "my change isn't showing" complaint. Today:
- `src/lib/query-client.ts` sets `staleTime: 2 * 60_000` and `refetchOnMount: false` — so navigating back to a list after an edit shows the cached stale version.
- Mutation callers are inconsistent: `src/components/explore/TaxonomyDialog.tsx` invalidates correctly on create, but `src/components/explore/ProductQuickEdit.tsx` saves via `updateProduct()` and never invalidates any query key. Same issue likely exists across product edit, order status changes, customer edits, bulk ops.
- Result: even though the server mirror is fresh (see task-162), the client's React Query cache keeps serving old data for up to 2 minutes.

Fix: build one opinionated mutation wrapper everyone uses, then sweep every mutation caller to adopt it.

**Wrapper contract** — a `useSiteMutation<TData, TVars>` hook (living in `src/hooks/useSiteMutation.ts`) built on top of `@tanstack/react-query`'s `useMutation` that accepts:
- `mutationFn` — the async call
- `invalidate` — an array of query keys (or a function returning them) to invalidate on success; pulled from `queryKeys` in `src/lib/query-client.ts`
- `optimistic` — optional `{ queryKey, updater }` pair that runs `setQueryData` immediately, rolls back on error
- `successToast` / `errorToast` — optional, default-on wording hooks (full formatting in task-165)
- `onSuccess` / `onError` — passthrough for callers that need extra work

Sweep targets (every place currently doing a mutation):
- `src/components/explore/ProductQuickEdit.tsx` — price/stock/status changes
- `src/components/explore/ProductsTab.tsx` (1227 lines — contains inline edits and bulk ops)
- `src/components/explore/OrdersTab.tsx` (998 lines — status changes)
- `src/components/explore/TaxonomyTab.tsx` / `TaxonomyDialog.tsx`
- `src/components/product-edit/BasicEditor.tsx` and tabs
- `src/pages/sites/[id]/products/new.tsx` and `products/edit/[productId].tsx`
- `src/pages/sites/[id]/orders/[orderId].tsx`
- `src/pages/sites/[id]/customers.tsx` and `customers/[customerId].tsx`, `customers/new.tsx`
- `src/pages/sites/[id]/settings.tsx` (site config)

**Optimistic updates** — apply to the fast-feedback edits where the new value is fully known client-side:
- Product: price change, regular/sale price, stock status toggle, publish/draft toggle, stock quantity
- Order: status change (processing → completed etc.)
- Category/tag: rename, description edit
- Customer: name, email, phone

For full-form saves (product advanced editor) optimistic is overkill — just do invalidation + toast.

**React Query defaults** — revisit `src/lib/query-client.ts`:
- Keep `staleTime: 2 * 60_000` (fine once invalidation is consistent)
- Change list queries to `refetchOnMount: "always"` OR keep `false` but rely 100% on explicit invalidation — pick one and document it
- Keep `refetchOnWindowFocus: false` (users are editing, not idle-tab-switching)

## Checklist
- [ ] Create `useSiteMutation` hook with `mutationFn`, `invalidate`, `optimistic`, `successToast`, `errorToast`, `onSuccess`, `onError` options
- [ ] Add missing query-key factory entries to `src/lib/query-client.ts` for customers, variations, product-detail, order-detail
- [ ] Refactor `ProductQuickEdit.tsx` to use `useSiteMutation` with optimistic cache update + list invalidation
- [ ] Refactor `TaxonomyDialog.tsx` (already invalidates, just adopt the wrapper) + add edit/delete flows
- [ ] Refactor product advanced editor flow (new.tsx, edit/[productId].tsx, BasicEditor.tsx) — invalidation only, no optimistic
- [ ] Refactor order status change in `OrdersTab.tsx` and `orders/[orderId].tsx` with optimistic update
- [ ] Refactor all inline edits in `ProductsTab.tsx` (price, stock, publish toggle) with optimistic update
- [ ] Refactor customer create/edit flows
- [ ] Refactor site settings save in `sites/[id]/settings.tsx`
- [ ] Pick one cache strategy in `query-client.ts` (explicit-invalidation-only vs. refetch-on-mount), document choice in a JSDoc comment on `makeQueryClient`
- [ ] Smoke-test: edit a product price from ProductQuickEdit → list shows new price immediately with no refresh
- [ ] Smoke-test: change order status → list + detail reflect new status immediately
- [ ] Smoke-test: create a category → appears in table without refresh

## Acceptance
- After any dashboard edit, the affected list/detail reflects the new value without a page refresh or manual revisit
- Optimistic edits show the new value instantly (before the server responds); on server error, the row reverts visibly with an error toast
- Every mutation caller in the codebase goes through `useSiteMutation` — grep for raw `useMutation` outside the wrapper returns zero results
