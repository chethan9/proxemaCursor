---
title: Image picker — fix scroll + infinite query + slim payload
status: done
priority: high
type: feature
tags: [products, media, performance]
created_by: agent
created_at: 2026-04-19
position: 69
---

## Notes
Fixes scroll in the product image picker and makes repeat opens instant for stores with many media items. Phase 1 of media scalability — keeps WP REST as source but cuts payload + caches aggressively. Phase 2 (Postgres mirror) lives in task-70.

**Scroll fix:** dialog content must enforce a concrete height so the inner scrollable grid can actually overflow. Today `flex-1 overflow-y-auto` collapses because the parent has no bounded height.

**Caching strategy:** switch to infinite query with 5-minute stale time and `keepPreviousData`. Only invalidate on upload, not on every open. Cache survives dialog close/reopen within the session.

**Slim payload:** API route should return only the fields the UI needs — `id`, `source_url`, `thumbnail_url`, `alt`, `title`, `mime_type`, `date`. Drops ~80% of response bytes vs raw WP media object.

**Scope:**
- `src/components/product-edit/ImagePickerDialog.tsx` — fix scroll container + switch to infinite query pattern
- `src/hooks/queries/useWpMedia.ts` — `useInfiniteWpMedia` with `getNextPageParam`, 5min staleTime
- `src/pages/api/stores/[storeId]/wp/media.ts` — return slim shape + `hasNextPage` flag from `x-wp-totalpages`
- `src/services/wpMediaService.ts` — update return type + shape
- Non-scope: database mirror, virtualization, upload UX changes

## Checklist
- [x] Dialog grid scrolls smoothly through 100+ images without layout breaking
- [x] First open loads 28 thumbs; scroll triggers next page near bottom (200px threshold)
- [x] Re-opening the dialog within 5 minutes shows cached images instantly with no network request
- [x] Upload adds new image to the top of the list and invalidates cache
- [x] Search debounces 300ms and resets pagination
- [x] "Select all" selects only what's currently loaded, with clear count indicator
- [x] API payload contains only fields the UI needs (id, source_url, thumbnail_url, alt, title, date)
- [x] Loading skeletons show while fetching next page; no CLS

## Acceptance
- Opening the picker on a store with 200+ images feels instant on second open.
- User can scroll through all pages without the dialog scroll breaking.
- Network tab shows one request per unique page, not per open.