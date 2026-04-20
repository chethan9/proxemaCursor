---
title: Mirror WooCommerce variations in Postgres (sync + fast edit)
status: todo
priority: high
type: feature
tags: [variations, performance, sync, database]
created_by: agent
created_at: 2026-04-20
position: 96
---

## Notes

**Problem.** Editing variable products is slow because on every page load and save we round-trip WooCommerce directly for variations. A 15-variation product means 1 `PUT products/{id}` + 1 `POST products/{id}/variations/batch` re-writing every row — Woo regenerates images, runs stock hooks, re-indexes attributes for all of them. Edit dialog also waits on a live `GET products/{id}/variations` just to open.

**Fix.** Treat variations exactly like products/orders/customers — a mirrored table in Postgres, kept fresh by the existing sync engine + webhooks. Edit UI reads from DB (instant), and save writes a **diff-only** batch to Woo (only changed variations).

### Database

Add `product_variations` table:
- `id uuid PK`, `store_id uuid FK → stores.id ON DELETE CASCADE`
- `product_id uuid FK → products.id ON DELETE CASCADE` (local parent)
- `woo_parent_id bigint NOT NULL` (woo product id — lets us sync without local parent)
- `woo_id bigint NOT NULL`
- `sku text`, `regular_price numeric(10,2)`, `sale_price numeric(10,2)`, `price numeric(10,2)`
- `stock_quantity integer`, `stock_status text`, `manage_stock boolean`
- `status text` (publish / private — `enabled` = status != 'private')
- `virtual boolean`, `downloadable boolean`, `tax_class text`
- `weight text`, `dimensions jsonb` (`{length,width,height}`)
- `description text`
- `attributes jsonb` (`[{name, option}]`)
- `image jsonb` (`{id,src,alt}`), `gallery jsonb` (`[{id,src}]`)
- `menu_order integer`
- `raw_data jsonb`
- `synced_at timestamptz default now()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`
- UNIQUE (store_id, woo_id), INDEX (store_id, product_id), INDEX (store_id, woo_parent_id)
- RLS: copy the products table pattern (`user_can_access_store(store_id)` scoped policies). Extend `sync_runs_aspect_check` (already allows `variations`) — no change needed.

### Sync engine

Update `src/pages/api/stores/[storeId]/sync.ts`:
- Add `syncVariations(store, syncRunId)` — iterate all variable `products` in the local DB, call Woo `products/{wooId}/variations?per_page=100` paginated per parent, upsert into `product_variations` by `(store_id, woo_id)`.
- Add `variations` to `syncFunctions` map and run it AFTER `products` (needs parent local id). Look up local product by `(store_id, woo_id)` to fill `product_id`.
- Respect the same `batchUpsert` / benchmarking pattern already used.

Update `src/pages/api/cron/sync-scheduler.ts` — include variations in its aspect list.

Update `src/pages/api/webhooks/incoming/[storeId].ts`:
- New topic handlers: `product.variation.created`, `product.variation.updated`, `product.variation.deleted` (or Woo's generic `product.updated` on a variation — map payload.type === 'variation' or fall back to a refetch of variations for that parent).
- On create/update: upsert into `product_variations`.
- On delete: move to `deleted_records` and `DELETE` the row.
- Register the new webhook topics in `src/pages/api/stores/[storeId]/register-webhooks.ts`.

### Edit flow (fast)

Refactor `src/pages/api/stores/[storeId]/products/[productId]/variations.ts` (`GET`):
- Read from `product_variations` first, return mapped shape. Add `?refresh=1` fallback that pulls live from Woo and upserts.

Refactor `src/pages/api/stores/[storeId]/products/[productId].ts` (`PUT`):
- Client sends `variations` plus `deletedVariationIds` as today, PLUS an `originalVariations` snapshot hash keyed by `woo_id` so server can diff. Simpler: client sends only the variations whose fields actually changed (`_dirty: true`). Pick **server-side diff** — safer.
- Load current rows from `product_variations` by `product_id`. For each incoming variation:
  - No `id` → add to `batch.create`
  - Has `id` and at least one mapped field differs from the DB row → `batch.update`
  - Otherwise skip entirely
- Only call Woo batch endpoint if `create.length + update.length + delete.length > 0`.
- After Woo responds, upsert changed rows into `product_variations` with the Woo response (new IDs + computed fields). Delete rows listed in `deletedVariationIds`.
- Log `entity_changes` fire-and-forget (await Promise.allSettled at end of request, don't block response).

### Client changes

- `src/pages/sites/[id]/products/edit/[productId].tsx` — load variations via the variations endpoint (already does). Instant because it reads DB.
- `src/services/productEditService.ts` — keep shape. No contract change. Client doesn't need to diff.
- Optional (v2): `?refresh=1` button in the variants tab header for manual re-pull.

### Edge cases / constraints

- A product imported as `variable` but never synced with variations → first edit page load triggers `?refresh=1` fetch + upsert, then uses DB going forward.
- Variation image gallery stored as meta_data `_wc_additional_variation_images` — sync should read that meta to populate `gallery`, and write expands when we update.
- `price` column is Woo's computed "current price" (sale if active else regular) — we map from response.
- RLS policy pattern: mirror `products` table (`user_can_access_store(store_id)`) and add a public/anon pair only if the existing tables do (they do).
- Keep migration purely additive — no changes to `products` or `sync_runs`.

## Checklist

- [ ] Migration: create `product_variations` table with columns, indexes, FKs, RLS policies matching `products` table
- [ ] `sync.ts`: add `syncVariations` function iterating variable products in local DB and paginating Woo variations endpoint per parent
- [ ] `sync.ts`: register `variations` in `syncFunctions` map, run AFTER `products` aspect
- [ ] `sync-scheduler.ts`: include `variations` in cron aspect list
- [ ] `register-webhooks.ts`: subscribe to `product.variation.created` / `updated` / `deleted` topics
- [ ] `webhooks/incoming/[storeId].ts`: route variation webhook topics to upsert / delete on `product_variations` (and `deleted_records`)
- [ ] Variations GET endpoint: read from `product_variations` by local `product_id`, return existing mapped shape; support `?refresh=1` to pull live + upsert
- [ ] Product PUT endpoint: server-side diff against `product_variations` — only send changed rows to Woo batch; then upsert Woo response into DB
- [ ] Product PUT endpoint: move `entity_changes` insert behind `Promise.allSettled` so it doesn't block response
- [ ] Product create endpoint (`products/create.ts`): after Woo creates parent + variations, upsert all variation rows into `product_variations`
- [ ] Regenerate Supabase types after migration so `product_variations` is typed
- [ ] First-time fallback: if GET returns empty for a variable product, trigger `?refresh=1` once automatically

## Acceptance

- Opening the edit page for a variable product shows variations instantly from the DB (no visible Woo fetch wait).
- Changing only the product name and hitting Save no longer re-writes every variation in Woo (batch call is skipped entirely when no variation changed).
- Editing a single variation's price and saving updates only that one row in Woo + Postgres; other variations in the DB keep their previous `synced_at`.
- Running a full store sync populates `product_variations` for all variable products and reports counts on the sync-runs page.
- A `product.variation.updated` webhook arriving from Woo upserts into `product_variations` within seconds without a full resync.