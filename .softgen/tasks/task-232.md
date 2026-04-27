---
title: New products not appearing in list after create (Woo OK, local DB miss)
status: done
priority: high
type: bug
tags: [products, sync, database, integrity]
created_by: agent
created_at: 2026-04-26
position: 232
---

## Notes

Server-side numeric hardening and loud error propagation across all product write paths. Fixes silent insert failures where Woo accepted the create but the local mirror rejected it (NaN, schema drift, missing columns).

## Checklist

- [x] Audit insertRow in `products/create.ts`
- [x] Add `toNumeric` helper, replace inline parseFloat
- [x] Stop swallowing Postgres upsert errors — throw saveErr
- [x] Apply same hardening to `products/[productId].ts` (update path)
- [x] Apply same hardening to `stores/[storeId]/sync.ts` (initial sync, all aspects)
- [x] Apply audit to product_variations writes
- [x] Verify React Query invalidation chain refreshes the list

## Acceptance

- Creating a product writes to Woo and the local mirror atomically; Postgres errors surface to the UI.
- All numeric fields handle empty strings, null, undefined, and malformed input without producing NaN.