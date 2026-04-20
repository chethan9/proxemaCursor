---
title: Simple product Basic editor redesign
status: todo
priority: high
type: feature
tags: [product-edit, basic, ux]
created_by: agent
created_at: 2026-04-20
position: 91
---

## Notes

Redesign `src/components/product-edit/BasicEditor.tsx` so simple products (WooCommerce `type: "simple"`) get an essentials-only, one-screen editor. Shared by both `src/pages/sites/[id]/products/new.tsx` and `src/pages/sites/[id]/products/edit/[productId].tsx`.

**Routing rules (already partially in place — verify):**
- Edit page defaults to **Basic** when `product.type === "simple"`.
- Edit page auto-flips to **Advanced** when `product.type === "variable"`.
- Basic/Advanced toggle stays visible in header for both; user can switch manually.

**Layout target** — two columns, designed to fit on one screen (no forced scroll on ≥1280px tall screens):

**Left column (main content):**
- Product name (large input).
- Description — keep rich text editor (existing `RichTextEditor`).
- Short description **removed on Basic** (only shown on Advanced).
- Media card: main product image (larger square ~140px) + horizontal gallery strip with + tile. Click opens existing `ImagePickerDialog`.
- Category picker: compact row showing selected categories as chips + "Add category" button that opens a small dropdown/popover with search + "Create new" (reuse `useWooTaxonomy` create mutation). Replace the current inline datalist + Add button.
- Tags: keep current chip input pattern (compact).

**Right column (sidebar cards, stacked):**
- **Status** card — dropdown (Active / Draft / Pending / Private).
- **Price** card — Regular price + Sale price on the **same row** (two inputs side-by-side with currency suffix). Below: "Free product" checkbox that zeros regular price and disables sale field. Auto-show "X% off" pill when both set and sale < regular.
- **Inventory** card — Track stock checkbox. If on: stock quantity input. Stock status as **segmented pill buttons** (In Stock / Out of Stock / On Backorder) replacing the current Select. SKU input at bottom.
- **Shipping** card — Weight (kg) input only. No shipping class, no dimensions, no flat rate.
- Sticky action row at bottom of right column: Cancel + Save changes / Publish.

**Visual polish:**
- Dismissible "Basic Mode" info banner at top of editor: title "Basic Mode", subtitle "Essential product details only. Switch to Advanced for taxes, variants, shipping rules & more." Persist dismissed state in localStorage.
- Use current design tokens (card, muted, border). No gradients, no custom hex.
- Keep 380px right column width; tighten card padding to `p-4` so everything fits.

**Data contract — no backend changes:**
- Continue using `formToWooPayload` from `src/services/productEditService.ts`.
- Free product toggle → sets `regular_price = "0"`, clears `sale_price`.
- Segmented pills write the same `stock_status` values.
- Weight writes to existing `form.weight` field.

**Out of scope:**
- Variable product flow (Advanced unchanged).
- Short description, dimensions, tax, shipping class — Advanced only.
- Backend / API route changes.

## Checklist

- [ ] Dismissible "Basic Mode" info banner with localStorage persistence
- [ ] Remove short description field from Basic editor (keep in Advanced tabs)
- [ ] Redesigned media card: larger main image + horizontal gallery strip
- [ ] Compact category picker: selected chips + popover dropdown with search and inline "Create new" option
- [ ] Price card: regular + sale in one row, "Free product" checkbox, auto discount % badge
- [ ] Inventory card: Track stock checkbox, qty input when enabled, stock status as segmented pills, SKU field
- [ ] Shipping card: single weight (kg) input
- [ ] Right column action row sticky at bottom with Cancel + Save/Publish
- [ ] Confirm edit page keeps simple products on Basic mode by default, variable on Advanced
- [ ] Tighten card padding and spacing so whole Basic form fits on ≥1280px screens without scroll

## Acceptance

- Opening a simple product in the editor lands on Basic mode and shows price + inventory + shipping fitting within the viewport on a standard 1440×900 screen without scrolling past the action buttons.
- Toggling "Free product" zeroes the regular price input and disables the sale price input; both prices filled shows a "% off" pill.
- Stock status segmented pills visibly highlight the active status and update the form state when clicked.
- Adding a new category via the picker creates it in WooCommerce (via existing `useCreateWooTaxonomy`) and adds it as a chip to the product.