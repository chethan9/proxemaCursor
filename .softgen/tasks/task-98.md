---
title: Enhanced product preview with gallery carousel
status: todo
priority: medium
type: feature
tags: [product-edit, preview, gallery]
created_by: agent
created_at: 2026-04-20
position: 98
---

## Notes

Expand the right-side live preview on the product edit page (Advanced mode) — `src/components/product-edit/LivePreviewCard.tsx` — from a single image into a proper gallery preview that shows what the customer actually sees on the storefront.

Reference layout (second image attached): main image fills the top, side arrow buttons overlay left/right edges for prev/next, a small fullscreen icon sits bottom-left of the main image, and a row of ~3-4 thumbnail tiles sits below the main image.

### Layout inside the preview card

1. **Main image area** (square aspect)
   - Shows currently-selected image from `form.images`
   - Left arrow button (absolute, centered vertically, 50% from top, left-2): `<ChevronLeft>` — prev image
   - Right arrow button (absolute, right-2): `<ChevronRight>` — next image
   - Arrows: circular 32px white/90% opacity bg, shadow, muted border, disappear when only 1 image
   - Bottom-left fullscreen button (absolute, bottom-2 left-2): `<Maximize2>` icon in small rounded button — opens full-screen lightbox dialog
   - Arrow keys on main image area cycle when focused

2. **Thumbnail strip** (below main image, inside card)
   - Horizontal scroll row, 4 visible at a time (~56px square each, gap-2)
   - Active thumb has ring-2 primary + ring-offset; inactive have border only
   - Clicking a thumb sets it as the active main image
   - Scroll horizontally if > 4 images

3. **Short description**
   - Keep existing product name + price
   - ADD below price: render `form.short_description` as HTML (dangerouslySetInnerHTML) in `text-xs text-muted-foreground line-clamp-3`
   - Hide the block entirely if short_description is empty

4. **Variants, stock, weight, SKU:** keep existing layout as-is

### Fullscreen lightbox

- Uses existing Dialog component (`@/components/ui/dialog`)
- Fills ~90vw × 90vh, black-ish background
- Same prev/next arrows (larger, 48px), same keyboard nav
- Thumbnail strip at bottom (larger, 80px)
- Close button top-right
- Click outside image also closes

### State

- `const [activeIdx, setActiveIdx] = useState(0)` in `LivePreviewCard`
- When `form.images` length changes (image added/removed), clamp `activeIdx` to valid range
- `const [lightboxOpen, setLightboxOpen] = useState(false)`

### Files

- Primary: `src/components/product-edit/LivePreviewCard.tsx` (75 lines → ~200 lines OK)
- Check: `src/components/product-edit/AdvancedShell.tsx` (how LivePreviewCard is mounted — right column width)
- `form.short_description` already exists on `ProductFormState` (check `src/services/productEditService.ts`)

## Checklist

- [ ] Replace single-image main slot with main+arrows+fullscreen-button in `LivePreviewCard.tsx`
- [ ] Add horizontal thumbnail strip below main image (4 visible, active highlighted)
- [ ] Render short_description HTML below price (line-clamped, hidden when empty)
- [ ] Add fullscreen lightbox dialog with larger arrows + thumb strip + keyboard nav
- [ ] Clamp activeIdx when images array shrinks; reset to 0 when main image changes
- [ ] Verify arrows + fullscreen button hide/show appropriately (0 or 1 images → hide arrows; 0 images → hide fullscreen button)

## Acceptance

- Editing a product with 5 images: preview card shows main image + 4 thumbs, clicking thumb swaps main
- Arrow buttons cycle through images; arrow keys work when preview focused
- Clicking the fullscreen icon opens a large lightbox; keyboard nav works there too
- Short description renders below price as muted small text, hidden when empty
- 1-image product: no arrows, no thumb strip, just main image + fullscreen button