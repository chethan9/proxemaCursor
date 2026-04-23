---
title: Fix post-save cache staleness — change not visible after edit until manual refresh
status: todo
priority: urgent
type: bug
tags: [react-query, cache, ux]
created_by: agent
created_at: 2026-04-23
position: 1
---

## Notes
After editing a product (or any entity) and clicking Save, the user is routed back to the list page but the row shows the OLD data until a manual refresh. Root cause is a React Query cache config contradiction introduced in `src/lib/query-client.ts`:

- `staleTime: 2 * 60_000` — data is considered fresh for 2 minutes
- `refetchOnMount: false` — don't refetch on mount even if stale

Combined effect: `invalidateQueries()` marks the list query stale, but because the list isn't currently mounted (user is on the edit page), nothing refetches. When the user lands on the list via `router.push`, the query mounts — but `refetchOnMount: false` prevents the stale-triggered refetch. So the user sees cached-old data.

Secondary issue in `src/hooks/useSiteMutation.ts`: the `onSuccess` callback fires `onSuccessExtra` (which does `router.push`) BEFORE awaiting `invalidateQueries`. Even if refetchOnMount were `true`, the navigation races the invalidation.

## Checklist
- [ ] In `src/lib/query-client.ts`, change `refetchOnMount: false` to `refetchOnMount: "always"` so every mount refetches stale queries in the background (keeps instant display from cache + updates on mount)
- [ ] In `src/hooks/useSiteMutation.ts`, change `onSuccess` to `await Promise.all(invalidateKeys.map(k => qc.invalidateQueries({ queryKey: k })))` BEFORE calling `onSuccessExtra` — so navigation happens with refetch already in flight
- [ ] Smoke test: edit any product, click Save, land on products list → row shows new values without a refresh
- [ ] Smoke test: edit a category inline, save → list shows new name immediately
- [ ] Smoke test: change order status on detail page, navigate to orders list → shows new status

## Acceptance
- After any save in the app, the destination list/detail reflects the new value within ~1 second of landing there, with no manual refresh
- `refetchOnMount: "always"` does not cause visible flicker — cached data shows instantly while refetch runs in background
