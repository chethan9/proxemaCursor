---
title: Product image picker dialog
status: done
priority: high
type: feature
tags: [ui, media, product-edit]
created_by: agent
created_at: 2026-04-19
position: 58
---

## Notes
Reusable dialog for selecting product images from WordPress media library or uploading new ones. Used across product edit (main image + gallery), variation detail dialog (variation image + variation gallery), and anywhere else images are picked.

**Component:** `src/components/product-edit/ImagePickerDialog.tsx`

**Design reference:** screenshot 5 — modal titled "Select Images", search input + "Upload New" button in header, responsive grid of image thumbnails (7 per row on desktop) with checkbox overlay on top-right, "Select All" toggle on footer-left, "Cancel" + "Add to album" buttons on footer-right.

**Behavior:**
- Multi-select mode (for galleries) and single-select mode (for main image)
- Search input debounced 300ms, passes to `wp/v2/media?search=`
- "Upload New" opens file picker (accept="image/*", multi), uploads each through `useUploadMedia`, new items prepend to grid with a "just uploaded" pulse ring
- Grid paginated: load 28 per page, infinite scroll on scroll-bottom
- Returns selected image objects `{ id, src, alt, name }[]` on confirm
- Loading skeleton while fetching, empty state when no results
- Error state when WP credentials missing → show inline CTA "Set up WordPress credentials in site settings" with link

## Checklist
- [ ] Image picker modal with search bar, upload button, responsive thumbnail grid, infinite scroll
- [ ] Single vs multi select modes controlled by prop
- [ ] Upload new: drag-drop zone + file picker, multiple files supported, shows upload progress per file
- [ ] Empty state, loading skeleton, and WP-credentials-missing error state
- [ ] Selected count indicator in footer ("3 images selected")
- [ ] Confirm returns array of media objects to caller

## Acceptance
- User can open dialog from product edit, search, select multiple images, confirm, and they appear in the product gallery
- User can upload new images that immediately become selectable and push to WP media library
- If WP credentials are missing, user sees actionable error, not a broken upload