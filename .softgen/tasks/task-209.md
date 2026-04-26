---
title: Advanced mode — tabbed nav with completion ticks
status: done
priority: high
type: feature
tags: [product-edit, ux]
created_by: agent
created_at: 2026-04-26T02:50:30Z
position: 209
---

## Notes

Replace the numbered stepper UI in `src/components/product-edit/AdvancedShell.tsx` with a tab-style nav. Steps remain (Basics, Pricing, Inventory, Variants — Pricing hidden for variable) but rendered as horizontal tabs with a small green check icon next to each tab whose mandatory fields are complete (uses existing `canAdvance(tab)` logic).

**Visual spec:**
- Use shadcn `Tabs` styling or custom pill row matching the rest of the app (see how `mode` toggle is done in edit page header for reference).
- Each tab label = step name. If `canAdvance(step)` returns true AND it's not the active tab → show `Check` icon (lucide, green, `--success`) next to label.
- Active tab uses `bg-foreground text-background` like existing toggle pattern.
- Free navigation — user can click any tab anytime (drop "Next/Back" forced sequencing).
- Keep "Cancel" + final "Save/Publish" buttons at the bottom of the card.

**Remove the Simple/Variable toggle inside Variants tab** (`src/components/product-edit/tabs/VariantsTab.tsx`) — Advanced mode = variable by definition. The Variants tab should always render in variable mode. Mode is now controlled only by the page-header Basic/Advanced toggle (handled in task-208).

**Preserve:** `AdvancedShell` props API (form, setForm, activeTab, setActiveTab, tabContent, canAdvance, onCancel, onPublish, saving, isEdit) — keep the same so the edit/new pages don't need to change. Only the visual rendering changes.

## Checklist

- [ ] Replace stepper markup in `AdvancedShell` with tab row; keep step list logic and `canAdvance` checks
- [ ] Add small green check icon next to completed tabs (skip on active tab)
- [ ] Drop "Next Step / Back" buttons; keep Cancel + Save/Publish
- [ ] Remove Simple/Variable toggle from `VariantsTab`; always treat as variable in Advanced
- [ ] Verify form state still flows correctly and validation messages still appear when saving with incomplete required fields

## Acceptance

- Advanced mode shows clickable tabs with green check next to completed ones.
- No numbered stepper; no forced sequential nav.
- Variants tab inside Advanced has no Simple/Variable toggle.
