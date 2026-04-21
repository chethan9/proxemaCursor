---
title: Categories and Tags pages regression fix + explorer standard reapply
status: done
priority: urgent
type: bug
tags: [categories, tags, taxonomy, ui-consistency, regression]
created_by: agent
created_at: 2026-04-21T20:15:00Z
position: 129
---

## Notes

Task 126 was marked done but the live page shows regressions:

**Bugs:**
- Data not loading — "No categories yet" and count `0` even though 11 categories exist in DB (verified earlier)
- Previous explorer-standard requirements from task 126 partially missing on the live UI

**UI issues visible in current screenshot:**
- Table has no card wrapper / no border → sits flat on background
- Toolbar count indicator shows "0" with orphaned middot separator
- No Sort dropdown (only a Filter button that does nothing for this view)
- No "+ New category" / "+ New tag" button
- Expanded-row design (from task 126) can't be verified because no rows load
- Spacing from sidebar looks tight — missing the `p-6 max-w-[1600px] mx-auto` wrapper that products/customers use

**Reference / source of truth:** `docs/UI_REFERENCE.md`. Mirror `src/components/explore/OrdersTab.tsx` and the customers list page (`src/pages/sites/[id]/customers.tsx`) for toolbar, table card, expanded row seam, and pill actions.

**Files:**
- `src/components/explore/TaxonomyTab.tsx` — rewrite to match explorer pattern
- `src/components/explore/TaxonomyRowExpanded.tsx` — ensure pill-style buttons, no visible seam
- `src/pages/sites/[id]/categories.tsx` and `src/pages/sites/[id]/tags.tsx` — ensure outer `p-6 max-w-[1600px] mx-auto` wrapper
- `src/hooks/queries/useTaxonomy.ts` — verify `useTaxonomyRows` query is wired correctly (debug why 0 rows return)
- `src/services/taxonomyService.ts` — verify the fetch path used by the hook

## Checklist

- [ ] Debug and fix data loading (0 rows issue) — inspect the query, check store_id param passing, confirm mode=categories vs tags handled
- [ ] Apply `p-6 space-y-4 max-w-[1600px] mx-auto` wrapper on both pages so the card has left gap and max width like products/customers
- [ ] Wrap table in `Card > CardContent p-0` (white surface with border radius) — no flat look
- [ ] Toolbar row: Sort dropdown (A→Z, Z→A, Most products, Fewest products, Recently added) + centered search + count indicator + Rows-per-page + pagination + "New category" / "New tag" button on the right
- [ ] Remove the orphan Filter button since there is nothing to filter on taxonomy — or replace with Parent filter (categories only)
- [ ] Table header bg-muted/30, rows bg-background (white), hover bg-muted/30
- [ ] Expanded row: single element, no visible seam, same bg as hovered row
- [ ] Action buttons in expanded row: pill-style (h-8, text-xs, justify-start, icon + label) matching orders/products expanded widget — Update, Delete, View on Woo (if url available)
- [ ] Parent category dropdown (categories only) populated and searchable
- [ ] Empty state shows only when truly empty, with icon + "No categories/tags yet" + secondary line
- [ ] Tags page mirrors the same pattern (no parent field in form)
- [ ] Verify against `docs/UI_REFERENCE.md` before marking done

## Acceptance

- Visiting Categories page shows all 11 categories with proper counts and a white-surface table, same visual rhythm as products/customers
- Visiting Tags page shows tags list with the same UI standard
- Expanding a row reveals a seamless edit panel with pill-style Update/Delete buttons
- Toolbar has Sort + centered Search + count + pagination + "New" button on the right
- Screenshot matches `docs/UI_REFERENCE.md` visual standard