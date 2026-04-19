---
title: Product edit page - Basic mode
status: todo
priority: high
type: feature
tags: [product-edit, ui]
created_by: agent
created_at: 2026-04-19
position: 59
---

## Notes
Single-page simple product editor matching the reference screenshot (Basic/Advanced toggle at top, essential fields only). Handles create + edit through same UI. Pushes to WooCommerce on save.

**Routes:**
- `/sites/[id]/products/new` — create new product
- `/sites/[id]/products/[productId]/edit` — edit existing product
- Entry points: "Add Product" button on products list + row action "Edit" on each product

**Shared page shell:** `src/pages/sites/[id]/products/[productId].tsx` (use `[productId]` with special value `new` OR separate routes — pick routing that avoids dynamic route conflicts). Both load the same `ProductEditor` component; diff is `mode: 'create' | 'edit'` + initial data.

**Basic Mode layout (reference screenshot 3):**

Header bar: back arrow + "Add new product" / "Edit product" title + Basic/Advanced segmented toggle (pill) + Preview, Save Draft, Publish buttons on right.

Info banner: "Basic Mode — Essential product details only. Switch to Advanced for taxes, variants, shipping rules & more." (dismissible).

**Left column (2/3 width):**
- Product Name input
- Description textarea (plain, no rich text in basic)
- Product Image (main) + Gallery (up to 8) — both open ImagePickerDialog
- Product Category — single-select combobox of Woo categories with inline "+ Create category" option (auto-creates via `useCreateCategory`)
- Options section: toggleable attributes (Color / Size / Custom) with value chips, "+ Add another option" — these become simple product attributes (not variations in basic mode)

**Right column (1/3 width):**
- **Price card**: Regular Price (with currency from store), Offer Price (optional, labeled "This is the actual selling price"), Free Product checkbox, live preview chip "15.00 KD ~~20.00 KD~~ 25% Off"
- **Inventory card**: Track stock checkbox, Stock quantity, Stock Status segmented (In Stock / Out of Stock / On Backorder)
- **Shipping card (optional)**: Weight (kg), Shipping Rate checkbox + amount

Footer: Cancel (link) + Publish Product (primary, full-width on mobile). "You can edit or add advanced settings anytime." helper text.

**Save logic:**
- `createProduct(storeId, payload)` / `updateProduct(storeId, productId, payload)` services
- Map form state to WooCommerce product payload (simple type, no variations)
- On success: show toast, redirect to products list, invalidate products query
- On error: show inline error banner with Woo response message

## Checklist
- [ ] Routes `/sites/[id]/products/new` and `/sites/[id]/products/[productId]/edit` mounted within SitePageShell
- [ ] "Add Product" button on products list opens create route; row Edit opens edit route
- [ ] Header bar with Basic/Advanced toggle (persists selection to query param `?mode=basic|advanced`), Preview/Save Draft/Publish actions
- [ ] Left column: Name, Description, Product Image + Gallery (via image picker), Category with inline create, Options section for simple attributes
- [ ] Right column: Price card (regular + offer + free toggle + live discount preview), Inventory card (track stock + qty + status segmented), Shipping card (weight + rate)
- [ ] Publish pushes payload to WooCommerce, handles loading + error states, redirects on success
- [ ] Edit mode pre-fills all fields from existing product + supports save updates

## Acceptance
- User can create a simple product with name, image, price, stock, category and see it in WooCommerce admin
- User can edit an existing product's basic fields and changes sync back to Woo
- Switching to Advanced mode preserves unsaved field values