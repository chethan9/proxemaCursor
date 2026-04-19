---
title: Advanced - Basic Info tab (name, description, media, taxonomy)
status: done
priority: high
type: feature
tags: [product-edit, advanced-mode]
created_by: agent
created_at: 2026-04-19
position: 61
---

## Notes
First tab of advanced mode (reference screenshot 4 top). Captures identity and organization of the product.

**Component:** `src/components/product-edit/tabs/BasicInfoTab.tsx`

**Fields:**
- **Product Name** (required) — single-line input
- **Description** — rich text editor with toolbar: Bold, Italic, Link, Emoji, Bulleted list, Alignment, "Add Media" button (opens image picker, inserts `<img>` into description HTML). Use a lightweight editor — TipTap or similar; must output HTML compatible with WooCommerce.
- **Product Image (main)** + **Gallery** — same image picker as basic mode
- **Product Category** — multi-select with inline create (shown as comma-separated list like "Ceramic Mugs, Minimal Mugs, ..."), "Change category" link opens tree picker dialog for nested categories
- **Brands** — single-select (or multi if brands plugin supports) with inline create, "Add brand" ghost button when empty
- **Product Tags** — multi-select tag input (like GitHub labels), inline create on Enter

**Footer:** Cancel (left) + Next Step → (right)

## Checklist
- [ ] Product Name and Description (rich text with toolbar: bold, italic, link, list, alignment, add media)
- [ ] Main image + gallery pickers wired to ImagePickerDialog
- [ ] Category multi-select with nested tree picker dialog and inline create
- [ ] Brand selector with inline create (fallback to disabled with tooltip "Install WooCommerce Brands plugin" if not available)
- [ ] Tag input with chip display and inline create on Enter
- [ ] Next Step validation: name required, at least one category required

## Acceptance
- User types product name, pastes rich description, picks images, assigns category + brand + tags
- Can create a new category/brand/tag inline without leaving the page
- Next Step button disabled until name and category are filled