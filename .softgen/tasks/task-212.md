---
title: Unsaved changes guard on product editor
status: done
priority: high
type: feature
tags: [product-edit, ux, safety]
created_by: agent
created_at: 2026-04-26T02:52:00Z
position: 212
---

## Notes

Prevent accidental loss of edits in `src/pages/sites/[id]/products/edit/[productId].tsx` and `src/pages/sites/[id]/products/new.tsx`.

**Dirty tracking:**
- After initial form load, snapshot the form state. Compare current `form` to snapshot via deep equality (e.g. `JSON.stringify` or fast-deep-equal). Expose `isDirty` boolean.
- Reset `isDirty` on successful save.

**Guards (only when `isDirty === true`):**
1. **Browser close / refresh / cross-origin nav** — `window.addEventListener("beforeunload", ...)` returning a string triggers the native browser prompt.
2. **In-app navigation (Next.js router)** — hook `router.events.on("routeChangeStart", handler)`. Handler shows a custom `AlertDialog`: "Unsaved changes. Save your changes before leaving?" with three buttons: "Discard" (proceed), "Save & continue" (calls save mutation, then proceeds), "Cancel" (stays). Use `router.events.emit("routeChangeError")` + `throw "ABORT"` pattern to cancel route change.
3. **Back / Cancel buttons** — wrap them to trigger the same dialog when dirty.

**Visual indicator:**
- Small "Unsaved changes" pill (warning color) next to the Edit product title when `isDirty`.

**Preserve:** All existing save/publish/delete logic, the `useSiteMutation` calls, the `serverErrors` flow.

## Checklist

- [ ] Snapshot form on initial load + add `isDirty` derived state
- [ ] Reset snapshot on successful save
- [ ] Wire `beforeunload` listener for browser-level prompt
- [ ] Wire Next.js `routeChangeStart` to show in-app confirm dialog with Discard / Save & continue / Cancel
- [ ] Intercept Back + Cancel buttons to trigger the same confirm flow
- [ ] Add "Unsaved changes" pill in the page header when dirty
- [ ] Apply the same guards on the new-product page

## Acceptance

- Editing any field then trying to leave (close tab, navigate, click Back) prompts confirmation.
- "Save & continue" runs the save mutation and only proceeds after success.
- After a successful save, no further prompt appears until the form is edited again.
