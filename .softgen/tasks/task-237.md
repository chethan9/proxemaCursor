---
title: Attribute picker shows existing global attributes + their terms before product publish
status: todo
priority: high
type: feature
tags: [products, variations, ux, woocommerce]
created_by: agent
created_at: 2026-04-26T22:30:00Z
position: 237
---

## Notes

Currently `AttributeEditor.tsx` in `src/components/product-edit/variants/` uses a plain text input + datalist for the attribute name, and free-typed strings for options. This is the proximate cause of task-233: users unknowingly type option strings that don't exist as terms of a matched global attribute.

Goal: surface the existing-attribute knowledge from Woo at the moment the user is editing, so they can pick existing global attributes + their existing terms by default and only type new ones consciously.

**UX changes** (in `AttributeEditor.tsx`):

1. **Attribute name input becomes a combobox** (use shadcn `Command` + `Popover`):
   - Top section: "Existing attributes" — list global attributes from `useWooAttributes(storeId)` with each row showing `name` + small muted count of terms.
   - Bottom: "Create custom attribute" affordance when typed name doesn't match any existing → confirms creating a NEW global attribute (current behavior) OR a one-off custom attribute (id: 0).
   - When picked from existing, the attribute card shows a "global" tag.

2. **Option input becomes term-aware** when the parent attribute is global:
   - Fetch terms via a new hook `useWooAttributeTerms(storeId, attributeId)` calling `GET /api/stores/{storeId}/wc/attributes/{attrId}/terms`.
   - Show existing terms as selectable chips in the attribute card.
   - Free typing still allowed, but flagged with a small "new — will be created on publish" badge so user knows.

3. **Combination preview for 2+ attributes**:
   - Below the attributes section, when ≥1 attribute marked `variation: true`, show a small "Will generate N variations" line where N is product of option counts.
   - Existing "Regenerate from attributes" button already does the cross-product — keep its behavior, just make the count visible.

**No changes to backend behavior** beyond what task-233 already covers (term reconciliation on save). The picker is a usability layer that prevents the bug class while task-233 makes it impossible at the API layer.

**Files to edit:**
- `src/components/product-edit/variants/AttributeEditor.tsx` — replace attribute name input with combobox; add term picker per attribute.
- `src/hooks/queries/useWooAttributes.ts` — add `useWooAttributeTerms` hook.
- `src/pages/api/stores/[storeId]/wc/attributes/[attrId]/terms.ts` — already exists, verify it returns `[{id, name, slug}]`.

## Checklist

- [ ] Replace plain input + datalist in `AttributeEditor.tsx` with a Command-based combobox listing existing Woo global attributes (name + term count), with a "+ Create new" footer item.
- [ ] When an existing global attribute is selected, fetch its terms and render them as a chip selector inside the attribute card; clicking a chip toggles it in `attr.options`.
- [ ] Free-typing a new option still works; show a small "new" badge on chips for options not in the registered term list.
- [ ] When a NEW global attribute is created (no existing match), behavior matches today — `createWooAttribute` mutation fires + new attribute card opens in edit mode.
- [ ] When user explicitly opts for a one-off custom attribute (id: 0), term picker is hidden; options are free text.
- [ ] Add a small line under the attribute list when ≥1 attribute is marked for variations: "Will generate {N} variations" where N is product of option counts across all `variation:true` attributes.
- [ ] Verify the existing "Regenerate from attributes" button still produces the full cross-product when 2+ attributes are used (e.g., Color × Size = 9 rows).

## Acceptance

- Adding an attribute named "Color" that already exists in the store shows its existing terms (e.g., Red, Blue, Green) as selectable chips immediately.
- Typing a new option ("Maroon") shows a "new" badge but is accepted; on save (after task-233 lands) the term is auto-registered.
- For a Color (3 options) + Size (4 options) variable product, the UI shows "Will generate 12 variations" before the user clicks regenerate.