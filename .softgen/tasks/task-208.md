---
title: Simple product single-screen + attribute support
status: todo
priority: high
type: feature
tags: [product-edit, ux]
created_by: agent
created_at: 2026-04-26T02:50:00Z
position: 208
---

## Notes

Simple product mode (`BasicEditor` in `src/components/product-edit/BasicEditor.tsx`) currently has no attributes section. Add attributes — simple products can have non-varying display attributes (e.g. Material: Ceramic, Origin: Japan) shown on the storefront.

**Mode switching rules:**
- Simple mode = ONE screen, no steps. All sections visible at once (current Basic layout).
- Switching `Basic ↔ Advanced` toggle at the page header (`src/pages/sites/[id]/products/edit/[productId].tsx`, `new.tsx`) controls layout.
- If product is variable AND user clicks "Basic" → show destructive `AlertDialog` warning: "Switching to Basic mode will remove all variations and convert this to a simple product. This cannot be undone." with Cancel + "Convert to simple" buttons. Only proceed on confirm; clear `form.variations`, set `form.type = "simple"`, drop `variation: true` flags from attributes.
- Inside the Basic editor, if user ticks "Use for variations" on any attribute → auto-switch to Advanced mode and set `form.type = "variable"` (no warning needed, additive change).

**Attributes section in simple mode:**
- Reuse `AttributeEditor` from `src/components/product-edit/variants/AttributeEditor.tsx` but pass `productMode="simple"` (already supported — hides the "Use for variations" checkbox per-row but keeps the per-row toggle that triggers the auto-switch above).
- Place after the Categories/Tags card in `BasicEditor`.
- Default `attribute.variation = false`, `attribute.visible = true`.

**Preserve:** All existing Basic editor sections (name, description, images, pricing, inventory, shipping, status, categories, tags). Do NOT delete or restructure them.

## Checklist

- [ ] Add Attributes card to `BasicEditor` after Categories/Tags, reusing `AttributeEditor` with `productMode="simple"`
- [ ] Wire "Use for variations" tick in simple mode to auto-promote to Advanced + set `type="variable"`
- [ ] Add destructive confirm dialog when switching Advanced→Basic on a variable product (in edit page header toggle)
- [ ] On confirmed Basic switch from variable: clear variations, reset `type` to `simple`, drop `variation` flags from attributes
- [ ] Verify simple product save still works with attributes payload (no variations sent)

## Acceptance

- Opening a simple product in Basic mode shows attributes editable on the same single screen.
- Ticking "Use for variations" on any attribute auto-switches to Advanced mode.
- Trying to switch a variable product to Basic shows a destructive warning; confirming wipes variations.
