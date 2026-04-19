---
title: Advanced - Pricing & Tax tab
status: done
priority: high
type: feature
tags: [product-edit, advanced-mode, pricing]
created_by: agent
created_at: 2026-04-19
position: 62
---

## Notes
Second tab (reference screenshot 4 bottom). Collapsible sections for Price and Tax.

**Component:** `src/components/product-edit/tabs/PricingTaxTab.tsx`

**Price section (expanded by default):**
- Regular Price with currency dropdown on the right
- Offer Price (optional) with currency dropdown — shown as the selling price

**Tax section:**
- "Charge tax on this product" checkbox
- Tax Rate input (only visible when checkbox checked) with % unit
- "Include tax rate in product price" checkbox

WooCommerce mapping:
- Regular price → `regular_price`
- Offer price → `sale_price`
- Tax charged → `tax_status: "taxable"` else `"none"`
- Tax rate → `tax_class` (map to configured tax classes on the store; default to "standard")
- Include in price → store-level setting, but surface as info text if the store is set to display prices excl. tax

**Footer:** Cancel + Back + Next Step →

## Checklist
- [ ] Price section with Regular Price + Offer Price (currency dropdown from store settings)
- [ ] Tax section with charge-tax checkbox, conditional tax rate input, include-in-price checkbox
- [ ] Validation: offer price must be less than regular price when both filled
- [ ] Both sections collapsible with chevron, remember open state per user session
- [ ] Next Step validates regular price > 0

## Acceptance
- User sets regular and offer price; preview updates with strikethrough + discount %
- Offer > regular shows inline error and blocks next
- Tax fields map correctly to WooCommerce tax_status + tax_class on publish