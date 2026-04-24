---
title: WooCommerce product rules enforcement across all edit surfaces
status: done
priority: high
type: feature
tags: [products, validation, woocommerce, quality]
created_by: agent
created_at: 2026-04-24T20:35:00Z
position: 191
---

## Notes

Align every product create/edit surface with the WooCommerce API contract so users can't save invalid data, and so the server rejects bad payloads even if the UI is bypassed. Today each surface applies a slightly different subset of rules — unify everything behind a single shared validator + normalizer, and enforce on the server too.

**Rules to enforce (from spec):**
1. `regular_price` required; string; must be **> 0** (no empty, no null, no "0" — "Free product" path must be removed or send `status=draft`)
2. If `stock_quantity` provided → `manage_stock` auto-set to `true`
3. If `manage_stock=true` → `stock_quantity` required & `>= 0`
4. `stock_quantity=0` → `stock_status` auto-set to `outofstock`; `stock_quantity>0` → `instock`
5. If `manage_stock=false` → `stock_status` defaults to `instock`, `stock_quantity` omitted from payload
6. `stock_quantity` never negative
7. `sku` **required** on save (currently optional) and must be **unique** across products + variations in that store; provide auto-generate fallback
8. `type` always explicit (`simple` or `variable`), never implicit default
9. **Variable parent must NOT send `regular_price`/`sale_price`** — current `formToWooPayload` sends them regardless → must strip for `type=variable`
10. Every variation must have price > 0, at least one attribute, and attributes matching parent exactly (case-sensitive match or normalize to lowercase consistently)
11. Attributes marked for variation must have `variation=true` at parent; variations can't exist before parent attributes
12. Duplicate attribute combinations across variations disallowed
13. Images: require valid `src` URL if provided
14. Categories: pass by ID only, never name
15. Trim all string inputs (name, sku, attribute names, options) before serialization
16. Consistent attribute referencing: prefer `id` if present, else `name` — don't mix `id:0` with names in same payload
17. Reject payloads with required fields present-but-empty

**Shared module (new):** `src/services/productValidation.ts` — pure functions:
- `normalizeProductForm(form)` → applies qty↔manage_stock↔stock_status coupling, trims strings, clamps negatives, strips parent price for variable type, normalizes attribute casing
- `validateProductForm(form)` → returns `{ ok: boolean, errors: { field: string, message: string }[] }` covering all rules above
- `validateVariation(v, parentAttrs)` → per-variation rules (price>0, attrs match parent, non-negative qty)
- `checkSkuUniqueness(storeId, sku, excludeProductId?, excludeVariationWooId?)` → queries supabase `products` + `product_variations` tables
- Re-export `buildWooPayload(form)` — replaces `formToWooPayload` with rule-compliant output

**Server-side enforcement:**
- `src/pages/api/stores/[storeId]/products/create.ts` and `[productId].ts`: run the same validator (shared with client) on incoming payload, reject with 400 + structured error list if it fails; also run SKU uniqueness check server-side against DB mirror before hitting Woo
- Handle Woo's duplicate-SKU 400 gracefully → return friendly error

**UI surfaces to wire:**
1. `ProductQuickEdit` (dialog from list/grid)
2. `ProductRowExpanded` (inline row editor — `src/components/explore/ProductRowExpanded.tsx`)
3. `BasicEditor` (`src/components/product-edit/BasicEditor.tsx`) — remove "Free product" checkbox, make SKU required with auto-generate fallback
4. Advanced tabs — `PricingTaxTab`, `InventoryShippingTab`, `VariantsTab`
5. `VariationEditDialog` + `VariationsTable` + `VariationsTab` — per-variation validation, duplicate-combo detection, SKU uniqueness check across variations
6. New product page (`src/pages/sites/[id]/products/new.tsx`) — block submit if validator fails, show grouped error summary near save button
7. Edit product page (`src/pages/sites/[id]/products/edit/[productId].tsx`) — same

**UX behavior:**
- Disable save/publish when validator returns errors; show red helper text under each offending field + a compact error summary above the action bar listing all blockers
- Auto-coupling (manage_stock, stock_status) happens silently as user types — no need to tick manage_stock manually once they enter a qty
- For SKU: async uniqueness check on blur (debounced), show inline "SKU already used by [product name]" with link
- Variable product: parent price inputs hidden entirely (not just disabled) when type=variable — only shown on variations
- Variations table: row goes red if price is missing/zero; "Publish" blocked until every enabled variation passes
- Every required field gets a red asterisk (`*`) next to its label across ALL surfaces: product name, regular price (simple + variation), SKU, stock quantity (when manage_stock=true), variation attributes. Use a shared `<RequiredLabel>` or extend the existing `Label` component with a `required` prop so asterisk styling stays consistent (red, small, semibold) everywhere.

**Attribute values picker (TagPicker pattern):**
When user adds/selects an attribute name in `AttributeEditor.tsx`, if that attribute exists as a **global Woo attribute** (matched by name via `useWooAttributes`), fetch its existing terms via the `[attrId]/terms` endpoint and display them as suggested chips (first 10 with `+` prefix, like `TagPicker`). Clicking a chip adds it to the `Values` list. Provide a "Browse all" button that opens a dialog listing every term with search — same UX as `TagPicker`'s browse-all dialog. User can still free-type a new option in the input (for custom per-product terms). If the attribute name doesn't match any global attribute, the chip row is hidden and only the free-type input shows.

## Checklist

- [x] Create `src/services/productValidation.ts` with `normalizeProductForm`, `validateProductForm`, `validateVariation`, `checkSkuUniqueness`, `buildWooPayload` (replaces `formToWooPayload`)
- [x] Strip parent `regular_price`/`sale_price` when `type=variable`; always send explicit `type`
- [x] Auto-couple stock fields: qty entered → manage_stock=true; qty=0 → stock_status=outofstock; qty>0 → stock_status=instock; manage_stock=false → omit stock_quantity, stock_status=instock
- [x] Make SKU required with auto-generate fallback when user leaves blank; add debounced async uniqueness check against `products` + `product_variations` tables in same store
- [x] Remove "Free product" path from `BasicEditor`; enforce regular_price > 0 for publish (draft still allowed with empty price)
- [x] Trim all string inputs; normalize attribute names/options casing consistently before serialization
- [x] Detect duplicate variation attribute combinations in `VariationsTab` + block save; show affected rows highlighted
- [x] Per-variation validation in `VariationEditDialog` + `VariationsTable`: price > 0, attrs present, qty non-negative; block parent save if any enabled variation fails
- [x] Wire validator into `ProductQuickEdit` and `ProductRowExpanded` — inline errors + save disabled state + auto-coupling
- [ ] Add error summary panel above save/publish button on new/edit product pages listing every blocking error with anchor links to the offending field
- [x] Server-side: mirror validator in `products/create.ts` and `[productId].ts`; return 400 with `{ errors: [{field, message}] }` on failure; add SKU uniqueness pre-check against DB before Woo call
- [x] Add a `required` prop to the shared `Label` component (or new `RequiredLabel` wrapper) that renders a red asterisk after the label text; apply consistently
- [x] Mark required fields with the red asterisk across all surfaces: name, regular price, SKU, stock quantity (when tracking), variation price, variation attributes — in ProductQuickEdit, ProductRowExpanded, BasicEditor, PricingTaxTab, InventoryShippingTab, VariationEditDialog, VariationsTable headers, new/edit product pages
- [x] Fetch suggested values for attribute: when attribute name matches a global Woo attribute, show first 10 existing terms as `+ value` chips above the "Add new option" input
- [x] Add "Browse all" button next to chips opening a searchable dialog of all terms for that attribute (mirror `TagPicker` browse-all UX)
- [x] Clicking a chip or selecting from browse-all appends the value to the variation `Values` list (dedupe; case-insensitive)
- [x] Hide suggestion chips when attribute name doesn't match any global Woo attribute; keep free-type input always available
- [ ] Translate Woo `product_invalid_sku` / 400 duplicate-SKU errors into friendly toast pointing at offending product

## Acceptance

- Saving a simple product without a price, or with price "0", is blocked in UI and rejected by server with clear per-field errors.
- Creating a variable product sends no price at parent level; each variation must have price > 0 or save is blocked.
- Entering a stock qty anywhere (quick edit, inline row, basic, advanced, variation) auto-enables manage_stock and auto-sets stock_status correctly without the user ticking anything.
- Duplicate SKU across products or variations in the same store is caught before the Woo call and surfaced with the conflicting product name.