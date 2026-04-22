---
title: Compact Edit Site dialog
status: todo
priority: high
type: chore
tags: [ui, density, dialog]
created_by: agent
created_at: 2026-04-22T04:00:00Z
position: 2
---

## Notes

**Problem:** The Edit Site dialog (`src/components/project/EditSiteDialog.tsx`, 358 lines) is so tall the Save/Cancel button row is pushed below the viewport fold — user can't see or reach it without scrolling. Screenshot shows dialog extending past the bottom of a standard laptop screen.

**Current layout issues visible in screenshot:**
- Three top inputs (Site Name, Store URL, Client) have standard height — fine.
- Store Timezone is a full-width row with a tall input + separate "Use mine" button on its own line.
- Two side-by-side cards (WooCommerce API + WordPress Media Access) have large inner padding, oversized icon tiles (48px+), big headings, tall Consumer Key/Secret password inputs stacked vertically.
- Danger Zone card is a full-width row with its own padding below everything.
- No visible footer — Save button is hidden below the fold.

**Goal:** Reduce vertical height by at least 40% so Save button is visible on a 900px-tall viewport without scrolling. Keep all functionality; reduce density only.

**Compaction targets:**
- Merge Store Timezone row: input + "Use mine" on the same line (no wrap).
- Cards: smaller icon tile (32px), smaller heading, reduce internal padding from default card padding to `p-3` or `p-4`.
- Consumer Key + Consumer Secret: reduce input height (`h-9`), tighter spacing between them, smaller labels.
- WordPress Media card: already sparse — reduce empty space below "Re-authorize" so it doesn't leave a large blank area next to the Woo card.
- Danger Zone: collapse to a single compact row — small warning icon + inline "Permanently delete this site" + Delete button on the right, all in one row with `py-2` instead of a full card.
- Overall dialog padding: reduce outer padding if currently large.
- Ensure dialog has a sticky or visible footer with Save/Cancel that stays within viewport.

**Don't change:** field labels, validation, any logic. Pure visual density pass.

## Checklist

- [ ] Reduce Edit Site dialog total height by ≥40% — measure before/after on a 900px viewport
- [ ] Store Timezone: input + "Use mine" button on one row, no wrap
- [ ] WooCommerce API + WordPress Media cards: smaller icon (32px), tighter padding, h-9 inputs, reduced label spacing
- [ ] Danger Zone: single compact row (icon + text + Delete button inline), not a full card block
- [ ] Ensure Save / Cancel footer is always visible in viewport on a 900px-tall screen without scrolling
- [ ] No functional changes: all fields, validation, handlers, and state behave identically

## Acceptance

- Opening Edit Site on a 900px-tall laptop shows the Save button without scrolling.
- Dialog feels dense but readable — nothing is cramped or overlapping.
- All fields, buttons, and actions still work exactly as before.