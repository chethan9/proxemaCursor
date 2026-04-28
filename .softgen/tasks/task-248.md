---
title: Product editor polish — tab scrollbar, View on store, brand mirror
status: done
priority: high
type: bug
tags: [products, brands, ui]
created_by: agent
created_at: 2026-04-28T00:00:00Z
position: 248
---

## Notes

Three issues on the product editor and brands page:

**1. Tab strip shows a small scrollbar.**
In `src/components/product-edit/AdvancedShell.tsx` (~line 73) the tabs container uses `overflow-x-auto`, which paints a thin scrollbar even when content fits. Replace with a no-scrollbar overflow (use `overflow-x-auto scrollbar-none` or a class that hides the WebKit/Firefox scrollbars while still allowing horizontal scroll on overflow). The project already has scrollbar-hiding utilities — confirm by checking `src/styles/globals.css` (search for `scrollbar`) and reuse the existing utility class. If none exists, add a `.scrollbar-none` rule there.

**2. "View on store" button missing on edit page.**
On `src/pages/sites/[id]/products/edit/[productId].tsx` add a button (or icon-button with tooltip) in the top-right header cluster, placed BEFORE the Basic/Advanced toggle. It opens the WooCommerce admin edit screen for that product in a new tab:

`{store.url}/wp-admin/post.php?post={woo_id}&action=edit`

Requirements:
- Only show when the product has a `woo_id` (already-published; for in-progress new products it's hidden)
- The product fetch already returns `woo_id` (top-level `p.id` from Woo); store it in component state alongside `form` so the header can read it. Add `const [wooId, setWooId] = useState<number | null>(null);` set during the load effect from `(p.woo_id as number) ?? (p.id as number)`.
- Use `lucide-react` `ExternalLink` icon, label "View on store", `<a target="_blank" rel="noopener noreferrer">` styled as a Button (variant="outline", size="sm")
- Strip trailing slash from `store.url` before composing

**3. Brands created via product editor don't show on `/sites/[id]/brands`.**
Root cause: `BasicInfoTab` brand creation calls `useCreateWooTaxonomy(storeId, "brands")` → POST `/api/stores/[storeId]/wc/taxonomy.ts`, which only creates in WooCommerce and does NOT insert into the local `brands` table. The brands explorer page reads from the local `brands` table, so it stays empty until the next full brand sync.

Two-part fix:

**3a. Mirror locally on creation.**
In `src/pages/api/stores/[storeId]/wc/taxonomy.ts`, after the successful Woo POST, when `kind === "brands"`, also insert the returned brand into the local `brands` table (mirror existing logic from `src/pages/api/stores/[storeId]/brands/create.ts` — same row shape: store_id, woo_id, name, slug, description, count, raw_data, synced_at). Same for `kind === "categories"` and `kind === "tags"` (mirror to `categories` / `tags` tables) so the bug doesn't repeat for taxonomy creation in the product editor. Use `supabaseAdmin` and ignore on conflict (in case the next webhook duplicates).

**3b. Add "Refresh from WooCommerce" button on brands page.**
On `src/components/explore/TaxonomyTab.tsx`, add a small button next to "Export" labeled "Refresh from WooCommerce" (icon: `RefreshCw`). Clicking calls a new endpoint that pulls the full brand list from Woo and upserts into the local `brands` table. The endpoint should:
- Path: `src/pages/api/stores/[storeId]/wc/sync-taxonomy.ts` POST, body `{ kind: "brands" | "categories" | "tags" }`
- Call `wooRequest(store, "GET", "products/brands?per_page=100&page=N")` paginated until empty
- Upsert all rows into `brands` (or `categories` / `tags`) keyed on `(store_id, woo_id)`
- Return `{ synced: N }`
- Show toast on success, invalidate the taxonomy query so the table refreshes

Make this button work for all three modes (categories/tags/brands) since the same root-cause applies.

## Checklist

- [ ] Hide horizontal scrollbar on the tabs strip in `AdvancedShell.tsx` (use existing `.scrollbar-none` or add one in globals.css)
- [ ] Track `wooId` state on the edit page when loading the product
- [ ] Add "View on store" outline button (with ExternalLink icon, opens `{store.url}/wp-admin/post.php?post={woo_id}&action=edit` in new tab) to the edit page header, only when `wooId` exists
- [ ] Mirror successful Woo taxonomy creation into the local `categories`/`tags`/`brands` table inside `wc/taxonomy.ts` POST handler (use supabaseAdmin, ignore conflicts on `(store_id, woo_id)`)
- [ ] Create `wc/sync-taxonomy.ts` endpoint that paginates Woo for the given kind and upserts all rows locally
- [ ] Add a "Refresh from WooCommerce" button to the toolbar in `TaxonomyTab.tsx` that calls the new endpoint, shows a toast, and invalidates the taxonomy query
- [ ] Verify on `/sites/[id]/brands` that clicking refresh populates the table when WooCommerce has brands but our DB doesn't

## Acceptance

- No horizontal scrollbar visible under the Basics/Inventory/Variants tab strip
- For an existing (saved) product, "View on store" appears in the editor header and opens the correct Woo admin edit URL in a new tab; for a brand-new in-progress product the button is hidden
- Creating a new brand from the product editor immediately makes it appear in `/sites/[id]/brands`
- Clicking "Refresh from WooCommerce" on the brands page pulls all Woo brands into the local table