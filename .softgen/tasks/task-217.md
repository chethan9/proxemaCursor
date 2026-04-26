---
title: Product type chooser + Status field parity in Advanced editor
status: todo
priority: high
type: feature
tags: [product-edit, ux, advanced-editor, add-product]
created_by: agent
created_at: 2026-04-26T12:00:00Z
position: 217
---

## Notes

Two related product-creation UX fixes.

### Part 1: Status field missing in Advanced editor

User reports the **Status** selector (Active / Draft / Pending / Private) — which is clearly visible in Basic mode (`src/components/product-edit/BasicEditor.tsx`) — is **missing or not visible** when:
- Editing an existing product and switching to Advanced view, AND
- Creating a new product (via `src/pages/sites/[id]/products/new.tsx`) and switching to Advanced.

Code reference: `src/components/product-edit/AdvancedShell.tsx` does contain Status logic (`STATUS_OPTIONS` line 17, render lines 126-148) but apparently it's not surfacing for the user. Build agent should:
- Open `AdvancedShell.tsx` and verify the Status block is mounted in both new-product and edit-product paths.
- Verify the Status section isn't hidden behind a collapsed accordion/sidebar that defaults to collapsed.
- Verify `new.tsx` passes a default form state including `status` so the AdvancedShell render path can resolve it.
- Make the Status block visually prominent in Advanced mode — same Active/Draft/Pending/Private pill row as Basic, placed in the top-right sticky sidebar so it never scrolls out of view. Should look identical to the Basic mode Status pills (rounded chips, dark = active selection).

### Part 2: Product type chooser dialog before "Add product"

Currently `ProductsTab.tsx:504` "Add product" button → router pushes directly to `/sites/[id]/products/new` (which defaults to Simple). User has to manually switch from Basic → Advanced → Variations to make a variable product. Friction.

**Replace direct navigation with a chooser dialog** that asks "What type of product are you adding?" with two side-by-side cards:

- **Simple Product** card — illustration `/simple.png`, title "Simple Product", description "For products with a single price, one SKU, and no variations.", arrow CTA. On click → navigate to `/sites/[id]/products/new?type=simple` and editor opens in Basic mode.
- **Variable Product** card — illustration `/variable.png`, title "Variable Product", description "For products with options like size, color, style, or other variations.", arrow CTA. On click → navigate to `/sites/[id]/products/new?type=variable` and editor opens directly in **Advanced mode with the Variations tab pre-selected**.

Visual reference: see attached design image (uploaded). Layout — centered icon header with package-plus icon in a soft purple bubble, "What type of product are you adding?" heading, "Choose the best option that fits your product" subhead, two equal cards below with rounded corners + soft pastel background tint behind the device-mockup illustration, an icon badge below the illustration (cube for Simple in indigo bubble, grid-of-four for Variable in mint bubble), title, two-line description, then a circular arrow button at the bottom.

Cards should feel airy with generous padding, subtle hover lift (translate-y -1, shadow), and the arrow button should highlight on hover. Cards are equal-width, stacked vertically on mobile.

Keep the dialog dismissible (X in corner + click outside).

### Wire-through to editor mode

`new.tsx` should read `?type=` query param:
- `type=variable` → set `form.type = "variable"` on init AND set advanced view as default AND focus the Variations tab.
- `type=simple` (or missing) → existing default behavior (Basic view, simple type).

Edit flow (`/products/edit/[productId]`) is unchanged — chooser only appears on Add.

## Checklist

- [ ] Verify Status block in `AdvancedShell.tsx` actually mounts and is visible in both new + edit flows. Move it to a prominent position in the right sidebar (top of sidebar, not buried in an accordion). Same pill style as Basic mode: 4 rounded chips, dark fill on selected.
- [ ] When creating a new product via `new.tsx`, ensure default form state includes `status: "publish"` (or whatever Basic uses) so AdvancedShell renders the pills with a default selection.
- [ ] Build product-type chooser dialog component with two cards: Simple Product (uses `/simple.png`) and Variable Product (uses `/variable.png`). Header icon (package-plus in soft tinted bubble), title, subtitle as per design.
- [ ] Each card: pastel tinted background blob behind illustration, illustration image, icon badge below illustration (cube icon for Simple in indigo bubble, grid icon for Variable in mint bubble), bold title, 2-line description, circular arrow button at bottom that lights up on hover. Whole card is clickable.
- [ ] Hover state: subtle lift + shadow + arrow button color shift.
- [ ] Wire `ProductsTab.tsx` "Add product" button to open this dialog instead of direct navigate. Dialog confirms with type → router pushes to `/sites/[id]/products/new?type=simple|variable`.
- [ ] In `new.tsx`, read `router.query.type` on mount. If `variable` → set form.type to variable, default the editor to Advanced view, auto-select Variations tab. If missing/simple → existing Basic-default behavior.
- [ ] Mobile responsiveness: cards stack vertically with full-width on screens <md.
- [ ] Dialog dismissible with X button + Escape + click outside.

## Acceptance

- Clicking "Add product" on the Products tab opens the type chooser dialog (not direct navigation).
- Choosing "Variable Product" lands on the new-product editor in Advanced view with Variations tab active and product type set to variable.
- Status pills (Active / Draft / Pending / Private) are visible at the top of the Advanced editor sidebar in both new and edit flows, matching the Basic mode look.
