---
title: Add Explore section with per-site product browser
status: in_progress
priority: high
type: feature
tags: [ui, products, explore]
created_by: agent
created_at: 2026-04-18T05:30:00Z
position: 21
---

## Notes
New user-facing "Explore" page. Lists connected sites; clicking a site opens tabbed view (Products, Orders, Tags, Categories). Focus on Products tab: search, sort, column visibility, CSV export, infinite scroll. Shopify-admin-style table with product thumbnails.

## Checklist
- [x] Create productService with paginated fetch, sort, search
- [x] Add Explore route in sidebar
- [x] Create /explore (site list)
- [x] Create /explore/[id] (tabs + products table)
- [x] Products: thumbnail, name, status, SKU, price, stock, category
- [x] Column visibility dropdown, sort dropdown, CSV export, infinite scroll