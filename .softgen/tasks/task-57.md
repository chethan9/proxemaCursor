---
title: WooCommerce attributes + media + taxonomy services
status: done
priority: urgent
type: feature
tags: [services, woocommerce, attributes]
created_by: agent
created_at: 2026-04-19
position: 57
---

## Notes
Foundation services for the product edit feature. These wrap WooCommerce REST API calls (via existing `src/lib/woo-client.ts`) and the WP media API. Used by the product edit pages, attribute editor, image picker, category/tag/brand inputs.

**Services (all under `src/services/`):**

1. **`wooAttributeService.ts`** — global product attributes
   - `listAttributes(storeId)` → GET `/wc/v3/products/attributes`
   - `createAttribute(storeId, { name, slug?, type?, order_by?, has_archives? })` → POST
   - `listTerms(storeId, attributeId)` → GET `/wc/v3/products/attributes/{id}/terms`
   - `createTerm(storeId, attributeId, { name, slug? })` → POST
   - `deleteTerm(storeId, attributeId, termId)` → DELETE

2. **`wooTaxonomyService.ts`** — categories, tags, brands (brands via `wc/v3/products/brands` if plugin present; fallback to tags)
   - `listCategories(storeId)`, `createCategory(storeId, { name, parent? })`
   - `listTags(storeId)`, `createTag(storeId, { name })`
   - `listBrands(storeId)`, `createBrand(storeId, { name })`

3. **`wpMediaService.ts`** — WordPress media library
   - `listMedia(storeId, { search?, page?, per_page? })` → GET `/wp-json/wp/v2/media`
   - `uploadMedia(storeId, file: File)` → POST `/wp-json/wp/v2/media` with multipart + Basic Auth header built from `wp_username:wp_app_password`
   - Error handling for 401 (surface "WP credentials invalid — update in site settings")

**React Query hooks (`src/hooks/queries/`):**
- `useWooAttributes.ts` — `useAttributes(storeId)`, `useAttributeTerms(storeId, attrId)`, `useCreateAttribute`, `useCreateAttributeTerm`
- `useWooTaxonomy.ts` — `useWooCategories(storeId)`, `useWooTags(storeId)`, `useWooBrands(storeId)`, mutations for create
- `useWpMedia.ts` — `useMediaLibrary(storeId, search)`, `useUploadMedia(storeId)`

All services must include console.log of `{data, error}` on mutations for debugging.

## Checklist
- [ ] Build `wooAttributeService.ts` with list/create attributes and list/create/delete terms
- [ ] Build `wooTaxonomyService.ts` with list/create for categories, tags, brands (brands plugin-optional)
- [ ] Build `wpMediaService.ts` with list + upload using Basic Auth from stored WP app password
- [ ] Create React Query hooks for each service with proper cache keys scoped by `storeId`
- [ ] Handle 401 errors in wpMediaService with friendly "credentials invalid" message

## Acceptance
- Can list and create a global attribute on a connected Woo store from a test harness
- Can upload an image to WP media library and receive back the public URL
- Can create a new category inline and it appears in WooCommerce admin