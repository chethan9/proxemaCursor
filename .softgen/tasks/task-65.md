---
title: Product + variations publish to WooCommerce
status: todo
priority: urgent
type: feature
tags: [product-edit, sync, woocommerce]
created_by: agent
created_at: 2026-04-19
position: 65
---

## Notes
The save pipeline that takes the form state from all tabs and pushes to WooCommerce, handles errors, and updates the local Supabase mirror.

**Service:** `src/services/productEditService.ts`

**Flow on Publish:**
1. Validate all tabs; show errors and block publish if invalid
2. Transform form state → WooCommerce product payload (simple OR variable type)
3. For Variable products: first create/update the parent product; then loop variations (batch endpoint `/products/{id}/variations/batch` supports create/update/delete in single call — use it)
4. For any new global attributes created inline: create via `/products/attributes` first, get back IDs, map into product payload
5. Upload any still-local images first (image picker outputs Woo media IDs, so usually already uploaded — but handle the edge case)
6. On success: patch Supabase `products` table (and variations if we add that table) via realtime sync OR trigger an immediate sync run for this product only via `/api/stores/{id}/sync?aspect=products&product_id={id}`
7. Redirect to product list with success toast

**Error handling:**
- Woo 400 errors (validation) → show per-field inline error on relevant tab, auto-switch to that tab, scroll to field
- Network errors → retry button on toast
- Partial variation failures → show summary "3 of 5 variations saved. Review errors." with list

**Draft save (`Save Draft` button):**
- Stores full form state in a new `product_drafts` Supabase table (`id, store_id, user_id, product_id (null for new), form_state jsonb, updated_at`)
- Draft badge appears on products list row for products with drafts
- Loading draft restores form state and marks tab as "draft — publish to apply"

**Preview button:** Opens a new tab with a client-side rendered preview page that mimics a Woo product page using form state (no backend round-trip).

## Checklist
- [ ] productEditService with `publishProduct` (create or update) and `publishVariations` using batch endpoint
- [ ] Inline-created attributes/terms resolved to IDs before product save
- [ ] Partial-failure handling for variation batch with per-row error display
- [ ] Post-publish: trigger single-product sync to refresh local Supabase mirror
- [ ] Save Draft writes to `product_drafts` table; products list shows draft badge
- [ ] Preview button opens client-rendered product preview in new tab

## Acceptance
- Publishing a product with all fields filled results in a complete product in Woo admin with variations, images, attributes, categories, tags, brand, taxes
- Validation errors from Woo surface on correct tab with field highlight
- Draft save and restore works across sessions
- Published product appears in local products list within 2 seconds