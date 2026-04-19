---
title: Advanced - Inventory & Shipping tab
status: todo
priority: high
type: feature
tags: [product-edit, advanced]
created_by: agent
created_at: 2026-04-19
position: 63
---

## Notes
Third tab (reference screenshot 6). Collapsible Inventory and Shipping sections.

**Component:** `src/components/product-edit/tabs/InventoryShippingTab.tsx`

**Inventory section:**
- SKU input with "✨ Auto SKU" button on the right (generates a random alphanumeric like `M2217819`, configurable prefix per store)
- "Track stock quantity for this product" checkbox
- Quantity input (number, conditional on track stock)
- Stock Status segmented: In Stock / Out Of Stock / On Backorder
- "Limit purchases to 1 item per order" checkbox (sold_individually flag)

**Shipping section:**
- Weight (kg) input
- Dimensions (cm) — 3 inputs: Length, Width, Height
- "Shipping Rate" checkbox — when checked, shows Shipping Rate input with currency suffix (per-product flat rate, written to product meta as custom field, requires compatible shipping plugin or serves as an internal cost reference)

WooCommerce mapping:
- SKU → `sku`
- Track stock → `manage_stock: true/false`
- Quantity → `stock_quantity`
- Stock Status → `stock_status` (values: "instock" | "outofstock" | "onbackorder")
- Limit 1 → `sold_individually`
- Weight → `weight`
- Dimensions → `dimensions: { length, width, height }`
- Shipping rate → post meta `_per_product_shipping_cost` (or custom)

## Checklist
- [ ] Inventory section: SKU + Auto SKU button, track stock checkbox, conditional qty input, stock status segmented, limit-1 checkbox
- [ ] Shipping section: Weight kg, 3-input dimensions, shipping rate checkbox + amount
- [ ] Auto SKU generator with store-configurable prefix (fallback to first 3 chars of product name + random 7 digits)
- [ ] Collapsible sections with remembered state
- [ ] Next Step validates SKU uniqueness per store (async check against products table)

## Acceptance
- User sets SKU (or auto-generates), stock qty, status; values push correctly to Woo
- Weight + dimensions save to Woo product
- Duplicate SKU warning blocks Next Step