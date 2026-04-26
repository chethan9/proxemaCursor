---
title: Compact attribute editor with inline value editing
status: done
priority: high
type: feature
tags: [product-edit, ux]
created_by: agent
created_at: 2026-04-26T02:51:00Z
position: 210
---

## Notes

Redesign `src/components/product-edit/variants/AttributeEditor.tsx` for a more compact, Shopify-like layout (see reference image: each attribute = one row with name, VARIATION badge, value pills, Edit button).

**Compact view (default, when not editing):**
- Single row per attribute: bold name + small "VARIATION" badge if `variation: true` + value pills inline + small Edit button on the right.
- Value pills are static text chips (no remove X by default — that lives in edit mode).
- Visibility checkbox stays but moves to a less prominent slot (e.g. tooltip toggle or only in edit mode).

**Edit mode (clicking Edit):**
- Expands the row inline (not a modal) showing the option name input + a list of value rows where each value is editable inline (current code only supports add/remove).
- Each value row: drag handle + editable input (commits on blur/Enter) + delete trash icon.
- Drag handles to reorder values (use existing `@dnd-kit` if installed, otherwise native drag).
- "Done" button collapses back to compact view; "Delete attribute" stays in edit mode.

**Add new attribute:**
- Compact "+ Add attribute" button instead of the inline input + datalist.
- Clicking it opens a small popover with the typed name input + datalist of existing global attributes.

**Preserve:**
- All existing logic: `useWooAttributes`, `useCreateWooAttribute`, `useWooAttributeTerms` for suggested values, term search dialog for >10 values.
- Form state shape (`form.attributes`).
- Auto-edit-newly-added behavior.

## Checklist

- [ ] Redesign compact row layout: name + VARIATION badge + value pills + Edit button
- [ ] Add inline-edit mode where value rows are editable inputs (commit on blur/Enter)
- [ ] Add drag-handle reordering of values within an attribute
- [ ] Replace inline add-attribute input with a "+ Add attribute" button + popover
- [ ] Keep "Use for variations" toggle and term-suggestion chips in edit mode
- [ ] Preserve all term-fetching and create-term logic

## Acceptance

- Each attribute renders as one tidy row with editable values via inline edit mode.
- Existing values can be renamed (not just removed/re-added).
- Adding new attributes uses a popover, not a permanent input row.
