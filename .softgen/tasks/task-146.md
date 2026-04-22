---
title: Free product visible in panel + category filter + count
status: done
priority: high
type: bug
tags: [products, taxonomy, sync]
created_by: agent
created_at: 2026-04-22T15:57:00Z
position: 146
---

## Notes
Bundles Px-17, Px-18, Px-28 (all touch the products/categories sync + filter path).

**Px-17 root cause:** `/api/stores/[storeId]/products/create.ts` inserted the new row via `.insert()`. If the webhook raced ahead and wrote first, the insert errored on the `(store_id, woo_id)` unique constraint and was effectively ignored — the returned API payload was the raw Woo object but the DB row wasn't guaranteed. Fixed with `upsert({ onConflict: "store_id,woo_id" })` so the row is always present after create, regardless of webhook timing. Also logs upsert error for future diagnostics.

**Px-18 root cause:** `fetchProducts` used `.ilike("categories::text", '%"name":"X"%')`. Postgres jsonb-to-text formatting can include a space after `:` in some builds, causing the ilike pattern to miss. Replaced with `.contains("categories", [{ name: value }])` — proper jsonb containment, format-independent.

**Px-28 root cause:** Category `count` comes from Woo's own `count` field (mirror). After product create, nothing invalidated the taxonomy queries, so the panel kept showing the cached count=0. `new.tsx` now invalidates both `["taxonomy", storeId, kind]` and `["woo", "taxonomy", storeId, kind]` after a successful create. Note: Woo's own count may update with a small lag — our re-fetch gets whatever Woo currently reports, which is the best available source of truth.

## Checklist
- [x] Replace `.insert()` with `.upsert({ onConflict: "store_id,woo_id" })` in `create.ts`; log upsert error
- [x] Replace ilike category filter with `.contains("categories", [{ name: value }])` in `productService.fetchProducts`
- [x] Invalidate `["taxonomy", storeId, *]` and `["woo", "taxonomy", storeId, *]` after successful create in `new.tsx`

## Acceptance
- Create a "Free product" → product appears in the panel list on next page load (no refresh loop)
- Category filter returns products for categories with spaces in their name (e.g., "Skin Care")
- Assign a product to a new category → Category module shows updated count without manual refresh (within Woo's own count-refresh window)
