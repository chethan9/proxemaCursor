---
title: Dark mode rollout
status: in_progress
priority: high
type: feature
tags: [theming, ui, dark-mode]
created_by: agent
created_at: 2026-04-25T19:30:00Z
position: 198
---

## Notes

Add full dark mode without changing light mode visuals. `next-themes` v0.4 + Tailwind `darkMode: class` already wired; `ThemeProvider` and `ThemeSwitch` components already exist but unused. Only foundation work is needed to activate.

**Hard rule:** Light mode must render byte-identical. Only NEW `.dark` selectors are added, no existing token values change.

**Risk areas after Phase 1:**
1. `[data-theme-preset="modern"]` block in `src/styles/globals.css` has ~10 hardcoded HSL literals (`hsl(220 13% 94%)`, `hsl(220 14% 98%)`, `hsl(220 9% 46%)` etc.) — won't flip in dark mode
2. Components that use `bg-white`, `text-black`, `text-gray-X`, `border-gray-X` instead of tokens — need audit via grep
3. Quill editor and Lottie animations may need explicit dark CSS
4. Status badges (success/warning/destructive) in `src/components/ui/status-badge.tsx` — verify token-only

## Checklist

### Phase 1 — foundation (no UI change in light mode)
- [x] Wire `<ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>` in `src/pages/_app.tsx`
- [x] Add `.dark` token block in `src/styles/globals.css` (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, success, warning, info, all sidebar tokens)
- [x] Add `.dark[data-theme-preset="classic"]` token block (preserves classic preset's teal accent in dark)
- [x] Render `<ThemeSwitch />` in a fixed position so the user can test before sidebar integration

### Phase 2 — placement + modern preset
- [ ] Move `<ThemeSwitch />` from floating into the sidebar user menu (read `src/components/layout/AppSidebar.tsx` first)
- [ ] Add `.dark[data-theme-preset="modern"]` overrides for the ~10 hardcoded HSL literals in globals.css (table headers, sidebar borders, skeleton fill, group labels, focus shadows)
- [ ] Verify the dropdown/select highlight backgrounds (`background-color: hsl(220 14% 94%) !important`) work in dark — replace with token reference

### Phase 3 — component sweep (risky surfaces)
- [ ] Grep all `bg-white\|text-black\|text-gray-\|bg-gray-\|border-gray-` and convert to tokens
- [ ] Check Quill editor `.ql-toolbar`, `.ql-container`, `.ql-tooltip` — already references tokens but verify dropdown visibility
- [ ] Check sync log status pills, sync progress banner, bulk jobs toast colors
- [ ] Check pricing page, checkout page, billing pages — verify cards/buttons/inputs all flip
- [ ] Check explore tabs (Products, Orders, Taxonomy) — large data tables
- [ ] Check site home dashboard charts (Recharts) — pass theme color via CSS var

## Acceptance

- Toggling theme to Dark flips background to near-black, foreground to near-white, all UI surfaces remain readable, no white flashes on cards/dialogs/popovers
- Toggling back to Light renders pixel-identical to pre-change baseline
- System preference is respected on first visit, remembered across reloads
- No FOUC (flash of unstyled content) on hard refresh