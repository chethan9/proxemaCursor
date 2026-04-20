---
title: Seamless row expansion polish (orders + taxonomy)
status: todo
priority: high
type: bug
tags: [explore, orders, taxonomy, ui]
created_by: agent
created_at: 2026-04-20
position: 90
---

## Notes

Product row expansion now renders as a single visual unit (task-89). Orders and taxonomy (categories + tags) still show a visible gap between the clicked row and the expansion body. Also: the order expansion right column ("Change status to" + "Actions") uses outdated colors, heavy borders, and is too wide — squeezing the middle customer/address column.

Surfaces to touch:
- `src/components/explore/OrdersTab.tsx` — the expanded `<TableRow>` currently renders `<OrderRowExpanded>` directly inside a `<TableCell colSpan>`. Wrap in a stop-propagation div, ensure no `border-t` gap, match the product pattern (`bg-muted/30`, `p-0`, seamless continuation). Remove the `border-t border-border` from inside `OrderRowExpanded` root so the header row + body read as one card.
- `src/components/explore/OrderRowExpanded.tsx` — right column refresh:
  - Reduce column width: grid becomes `1fr 1fr 200px` (was 240px) so customer/address get more room.
  - Status buttons: tighter, softer borders (`border` not tinted-heavy), compact `h-8`, consistent muted palette using shadcn tokens (`--success`, `--warning`, `--primary`, `--destructive`, `--muted`) instead of raw tailwind colors like `purple-500`, `amber-500`, `slate-500`.
  - Action buttons: compact `h-8`, ghost-style hover, arrow icon only (no extra chrome).
  - Remove the outdated `STATUS_STYLES` mixed palette; reuse the same token colors the table status badges use (`STATUS_COLORS` in OrdersTab).
- `src/components/explore/TaxonomyTab.tsx` — expanded row currently has `border-y` on `TaxonomyRowExpanded` root, and the wrapping TableCell doesn't strip padding cleanly. Remove the gap so category/tag expansion flows from the row header.
- `src/components/explore/TaxonomyRowExpanded.tsx` — drop `border-y border-border` root class; use `bg-muted/30` and keep only the internal divider under the ID/Name/Parent header block. Keep internal padding.

## Checklist

- [ ] Orders: wrap `OrderRowExpanded` in stop-propagation + bg-muted/30 TableRow, no visible gap between clicked order row and expansion
- [ ] Orders: trim right column width (240px → 200px) so customer + address get more horizontal space
- [ ] Orders: redo "Change status to" buttons with shadcn semantic tokens (success/warning/primary/destructive/muted) — compact h-8, soft borders, no raw tailwind color classes like purple-500/amber-500/slate-500
- [ ] Orders: simplify "Actions" buttons — compact h-8, consistent ghost/outline, subtle arrow
- [ ] Orders: remove `border-t border-border` from `OrderRowExpanded` root so header + body read as one unit
- [ ] Taxonomy: drop `border-y border-border` from `TaxonomyRowExpanded` root; use `bg-muted/30` with no top border
- [ ] Taxonomy: ensure expanded TableCell has `p-0` and no extra border above expansion body
- [ ] Verify on categories AND tags that the clicked row + expansion body look like one seamless card

## Acceptance

- Clicking an order or category/tag row expands inline with zero visible gap — identical feel to product expansion.
- Order expansion right column is visibly narrower; customer name, email, phone, and both addresses no longer feel cramped.
- Status change buttons use consistent theme tokens (no random purple/amber hex), look modern, and fit in the narrower column without overflow.