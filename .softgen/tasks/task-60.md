---
title: Product edit page - Advanced mode shell + live preview
status: done
priority: high
type: feature
tags: [product-edit, ui, advanced-mode]
created_by: agent
created_at: 2026-04-19
position: 60
---

## Notes
Advanced mode wrapper: tabbed wizard on the left (Basic Info → Pricing & Tax → Inventory & Shipping → Variants) with a live product preview card pinned on the right (reference screenshots 4, 6, 7, 8). State is shared across tabs via a form context provider so switching tabs preserves input.

**Components:**
- `src/components/product-edit/AdvancedEditorShell.tsx` — wrapper with tabs + preview split
- `src/components/product-edit/ProductEditContext.tsx` — React Context holding form state, dispatch actions, validation state per tab, push-to-woo mutation
- `src/components/product-edit/LivePreviewCard.tsx` — the right-side preview matching reference (image placeholder, title, description snippet, price with strikethrough + discount badge, attribute chips for Size/Color, Stock/Shipping/Tax chips at bottom)

**Layout:**
- Header: same as basic (back arrow, title, Basic/Advanced toggle, Preview/Save Draft/Publish)
- Split view below: left 60% = tab bar (underline style) + tab content, right 40% = sticky LivePreviewCard
- Tabs use orange underline for active, tab content loads conditionally (no unmount — preserve state)
- Footer: Cancel + Back + Next Step / Publish Product (last tab)

**LivePreviewCard content:**
- Large image area (placeholder if no image)
- Product title (defaults to "Product Name" placeholder)
- 3-line description preview (truncated with ellipsis)
- Price row: offer price bold + regular price struck through + discount % badge
- Attribute sections: one per active attribute (e.g. Size / Color) with value chips (first chip highlighted)
- 3-column mini stats row at bottom: Stock / Shipping / Tax

**Context API:**
- `useProductEditor()` returns `{ form, patch, errors, isDirty, mode, storeId, productId, publish, saveDraft, goNextTab, goPrevTab, activeTab, setActiveTab }`
- `patch(partial)` merges into form state
- Validation runs per-tab and blocks Next Step if required fields missing on current tab

## Checklist
- [ ] AdvancedEditorShell with 4-tab nav (Basic Info, Pricing & Tax, Inventory & Shipping, Variants) and right-side preview pane
- [ ] ProductEditContext with form state, per-tab errors, and publish/saveDraft handlers shared across basic + advanced
- [ ] LivePreviewCard showing image, title, description, prices with discount, attribute chips, stock/shipping/tax stats
- [ ] Advanced/Basic toggle preserves all form values when switching modes
- [ ] Footer navigation: Back (prev tab), Next Step (next tab with validation), Publish (final tab only)
- [ ] Responsive: preview card stacks above on mobile; tabs become horizontal scroll

## Acceptance
- User can navigate through all 4 tabs with state preserved
- Live preview updates instantly as user types
- Invalid required fields on current tab block progress to next tab with inline error messages