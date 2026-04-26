---
title: New products not appearing in list after create (Woo OK, local DB miss)
status: todo
priority: urgent
type: bug
tags: [products, create, sync, regression, live-issue]
created_by: agent
created_at: 2026-04-26
position: 232
---

## Notes

User reports: after adding a product (both simple and variable), the new product does NOT appear in the products list. Refresh and waiting many minutes don't help. Used to appear instantly. Reproduces on the live site (no live DB access for the agent).

WooCommerce side IS getting the product (user can see it) — the regression is between Woo's response and our products list refetch.

### Where it breaks (code-side)

`src/pages/api/stores/[storeId]/products/create.ts`:
1. POSTs to Woo → gets `created` with `id`
2. Upserts variations into `product_variations` (variable products only)
3. Upserts parent into `products` table:
   ```ts
   const { data: inserted, error: insertErr } = await supabaseAdmin
     .from("products")
     .upsert(insertRow as never, { onConflict: "store_id,woo_id" })
     .select("*")
     .single();
   if (insertErr) {
     console.error("[product-create][db-upsert]", insertErr);  // ← silent failure
   }
   return res.status(200).json(inserted || { ...insertRow, id: `woo-${wooId}` });
   ```

If `insertErr` happens, the API returns 200 with a fake `id: "woo-{wooId}"` row. UI sees success, list invalidates, refetches from `products` table — row isn't there. User waits forever.

### Two likely causes for the silent insert error

1. **Schema drift from recent migration.** `supabase/migrations/20260426121341_migration_5f66421c.sql` (97 lines, the largest recent migration) probably added one or more NOT NULL columns to `products` (or changed a constraint). The `insertRow` object in `create.ts` was not updated.
2. **NaN from empty Woo price strings.** For variable products the parent has empty `price`/`regular_price`. Code does `parseFloat(created.price as string)` — `parseFloat("") === NaN`. Inserting NaN into a `numeric` column fails with `22P02 invalid input syntax for type numeric: "NaN"`. Current pattern uses `created.price ? parseFloat(...) : null` which filters `""` out (falsy), so this is less likely than (1) but should still be hardened.

### What changed recently (git log)

Recent product-create commits since the regression window:
- `0680d2e feat(products): add type selection dialog and fix status field`
- `0acf592 feat(product): finalize product editor implementation`
- `23e8e92 feat(billing): implement server-side quota enforcement`

The quota commit added a `canAddProductServer` check before insert. If quota throws here, no product is inserted but Woo would also not be created — so this isn't the cause (Woo IS getting the product).

## Checklist

- [x] **Open `supabase/migrations/20260426121341_migration_5f66421c.sql`** and read what columns/constraints it changed on the `products` table. Cross-reference with the `insertRow` object in `src/pages/api/stores/[storeId]/products/create.ts` (lines ~280–305). List any NOT NULL column that `insertRow` is missing.
- [x] Update `insertRow` in `create.ts` to include the missing columns. Pull values from `created` (the Woo response) where available; provide sensible defaults otherwise (`null`, `false`, `0`, `[]`, `{}` per type).
- [x] **Stop swallowing the upsert error**: replace the silent `console.error` with `if (insertErr) throw insertErr;`. Wrap in try/catch at handler level so the user gets a real 500 with the actual Postgres error message instead of fake success. This regression went undetected precisely because the error was eaten.
- [x] Harden price/numeric parsing: write a helper `toNumeric(v: unknown): number | null` that returns `null` for `""`, `null`, `undefined`, `NaN`. Use it for `price`, `regular_price`, `sale_price`. Replace inline `created.x ? parseFloat(...) : null` patterns.
- [ ] Apply the same fix in `src/pages/api/stores/[storeId]/products/[productId].ts` (update path) and `src/pages/api/stores/[storeId]/sync.ts` (initial sync upsert) so initial-sync and updates also catch schema drift loudly.
- [x] Apply the same `insertRow` audit to `product_variations` upsert in the variations batch block of `create.ts` (lines ~210–260) — same migration may have touched that table.
- [x] Verify the products list query invalidation chain in `src/hooks/useSiteMutation.ts` — `invalidateKeys: [queryKeys.products(id), ...]`. The cached key in `useProducts` is `[...queryKeys.products(storeId, opts), "live"|"db"]`. TanStack prefix-matches, so this should work — but confirm by reading `src/lib/query-client.ts`'s `queryKeys.products` factory; if it returns a non-array prefix or includes the opts in the base, the invalidation won't match.
- [ ] After fixing, deploy and have user create a simple + variable product. New product should appear in the list within 1–2 seconds (TanStack invalidate + refetch). Watch the Network tab — `POST /api/stores/.../products/create` should return 200 with a real DB row id (UUID), not `woo-{number}`.
- [ ] Add a defensive integration test that asserts the create endpoint's response `id` is a UUID (not a fallback string starting with `woo-`).

## Acceptance

- Creating a simple product on the live site shows it in `/sites/{id}/products` within 2s, no manual refresh.
- Creating a variable product (with attributes + variations) does the same. Variations show in the row's expanded view.
- Server console shows zero `[product-create][db-upsert]` errors. If a real schema mismatch occurs, the user sees a clear 500 toast with the Postgres message instead of a silent "success" that doesn't appear.
- Same flow works on the edit page (`[productId].ts`) — modifying a product reflects in the list immediately.