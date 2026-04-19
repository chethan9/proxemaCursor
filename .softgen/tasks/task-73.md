---
title: Compact date range filter calendar
status: todo
priority: high
type: bug
tags: [ui, calendar, date-filter]
created_by: agent
created_at: 2026-04-19T21:55:00Z
position: 73
---

## Notes

The date range filter calendar in `src/components/explore/DateRangeFilter.tsx` renders far too tall — each row has ~55-65px of vertical spacing between dates, making the popover almost 2× the height shown in the reference (`uploads/image_4d6d914e-98ff-43ee-b282-108649b1f345.jpg`). Previous attempts to shrink cells via `h-7 w-7` classNames in `src/components/ui/calendar.tsx` had no visible effect.

**Root cause (verified hypothesis):** react-day-picker uses a CSS custom property `--rdp-cell-size` (default 40px) that controls cell dimensions. Tailwind class overrides on the `day`/`cell` classNames get overridden by this variable. Setting `--rdp-cell-size` directly on the Calendar root element forces the correct size regardless of class conflicts.

**Evidence:** package.json uses `react-day-picker` v8; its stylesheet defines `.rdp { --rdp-cell-size: 40px }` which computes to row-height × 6 rows = ~240px alone.

**Approach:**
1. Audit `src/styles/globals.css` for any `.rdp-*` rules that may interfere
2. In `src/components/ui/calendar.tsx`, pass inline `style={{ "--rdp-cell-size": "28px" } as React.CSSProperties}` to the DayPicker root — this is the authoritative way to compact the calendar
3. Verify the DateRangeFilter popover becomes proportional to the reference image (roughly square calendar body, matching left preset column height)
4. Confirm two-month range layout (when used elsewhere) still looks right

**Reference target:** `uploads/image_4d6d914e-98ff-43ee-b282-108649b1f345.jpg` — Custom preset highlighted, two date fields at top, calendar grid below, Cancel/Apply footer. Overall popover height ≈ 420px, not 700px+.

## Checklist

- [ ] Open `src/styles/globals.css` and search for `rdp`, `react-day-picker`, or any `[role="gridcell"]` rules — note or remove anything that forces cell size
- [ ] Update `src/components/ui/calendar.tsx` to accept a `cellSize` prop (default 28) and apply it as `style={{ "--rdp-cell-size": "${cellSize}px" }}` on the root DayPicker
- [ ] Verify the single-month calendar inside `DateRangeFilter` now renders at roughly 220px × 220px (square-ish), not ~400px tall
- [ ] Verify other calendar usages in the app (product edit, sync-runs date filter, etc.) still look correct — they should be unchanged since we keep 28px default which matches existing `h-7 w-7` attempt
- [ ] Compare final popover against reference image — preset column height should match calendar + footer height within ~20px
- [ ] Ensure Cancel/Apply footer is visible without scrolling

## Acceptance

- The DateRangeFilter popover, when "Custom range…" is selected, has a calendar body that is roughly square (width ≈ height) and the full popover fits comfortably in ~440px of vertical space.
- No regression in other calendar usages in the app.
- Visual match to `uploads/image_4d6d914e-98ff-43ee-b282-108649b1f345.jpg` proportions.