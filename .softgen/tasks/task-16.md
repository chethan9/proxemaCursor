---
title: Rework UI with Shopify Polaris design language
status: done
priority: high
type: chore
tags: [ui, design-system, accessibility]
created_by: agent
created_at: 2026-04-18T01:20:00Z
position: 16
---

## Notes
Adopt Shopify Polaris design language as the default. Scope is UI/UX only — no feature or logic changes. Work at the design-token + shared-layout level so all existing pages inherit the new look automatically via shadcn semantic tokens.

Polaris design principles applied:
- Brand green primary (#008060) — used for primary actions, active nav, focus rings
- Neutral page surface #f6f6f7, elevated surface #ffffff, subtle #e1e3e5 borders
- Text #202223 (near-black, not pure black) on body, #6d7175 muted
- Critical #d72c0d, warning #ffc453, success #008060, highlight #f1f8f5
- Inter font (already used), slight font-weight boost on headings, tighter leading
- Card-first layout: Page header → stacked cards with subtle 1px border + soft shadow
- Rounded corners at 8px (lg), 6px (md)
- Accessibility: visible focus rings (2px primary + offset), 4.5:1+ text contrast, aria-labels on icon-only buttons, semantic landmarks (header/nav/main), skip link

## Checklist
- [ ] Update src/styles/globals.css: Polaris HSL tokens for --background, --foreground, --card, --primary, --border, --muted, --destructive, --ring, --sidebar-*; add focus-visible ring utility
- [ ] Update tailwind.config.ts: confirm font stack, add Polaris shadow + radius scale
- [ ] Update src/components/layout/AppLayout.tsx: Polaris page header style (title + subtitle + actions slot), max-width container, skip-to-content link
- [ ] Update src/components/layout/AppSidebar.tsx: Polaris-style nav with section groups, active pill indicator, icon + label alignment, aria-current
- [ ] Update src/components/ui/button.tsx: Polaris button variants (solid primary, plain, subtle), stronger focus ring
- [ ] Update src/components/ui/card.tsx: thinner border, softer shadow, tighter padding rhythm
- [ ] Update src/components/ui/badge.tsx + status-badge.tsx: Polaris tone colors (success/warning/critical/info)
- [ ] Update src/components/ui/input.tsx: Polaris border + focus treatment
- [ ] Verify no feature regressions via check_for_errors