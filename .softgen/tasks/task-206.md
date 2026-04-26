---
title: Advanced product editor — stepper, status pill, and variable-product flow
status: done
priority: high
type: feature
tags: [product-edit, ux, advanced-shell]
created_by: agent
created_at: 2026-04-26
position: 206
---

## Notes
Refine the Advanced product edit shell at `src/components/product-edit/AdvancedShell.tsx` with three connected changes. The Basic editor variant (`BasicEditor.tsx`) is unaffected.

**1. Replace tab row with a numbered step indicator**
- Today: `Basic Info | Pricing & Tax | Inventory & Shipping | Variants` rendered as a thin underlined tab row at the top of the editor card. The active tab uses a `border-primary` underline only — visually weak and far from the content.
- New: a stepper at the top of the card showing numbered circles (1 → 2 → 3 …) connected by a line.
  - **Pending** step: muted-background circle with the number, muted text label below.
  - **Active** step: filled `bg-primary text-primary-foreground` circle, label in `text-foreground` font-medium, with a subtle ring (`ring-2 ring-primary/20`) wrapping the circle so the active state is unmistakable.
  - **Completed** step (all required fields on that step satisfied per `canAdvance`): `bg-success` (emerald) circle showing a checkmark icon instead of the number, label in `text-success` (or `text-foreground`) — green signals "this section is done".
  - Connector line between steps: muted by default, turns `bg-success` between any two completed steps.
  - Each step circle is clickable to jump to that step (same behavior as current tab buttons). Keep keyboard accessibility (button element, focus ring).
- Step labels stay short: "Basics", "Pricing", "Inventory", "Variants" (or current labels — pick whichever reads cleaner under small circles, document the choice in the file).
- Reuse existing `canAdvance(tab)` to derive completion state. A step is "completed" when `canAdvance` returns true AND it's not the currently active step (active step is shown as active even if complete).

**2. Hide Pricing & Tax step for Variable products; merge Tax into Inventory & Shipping**
- When `form.type === "variable"`, the pricing of the product itself is determined per-variation, so the standalone "Pricing & Tax" step is misleading.
- Behavior:
  - Variable: stepper shows 3 steps → `Basics → Inventory & Shipping (incl. Tax) → Variants`.
  - Simple: stepper shows 4 steps as today → `Basics → Pricing & Tax → Inventory & Shipping → Variants` (Variants step in simple mode just shows the attributes editor with no variations table — current behavior, keep it).
  - The active-tab list and `TABS` array in `AdvancedShell.tsx` must be derived dynamically from `form.type`. If user toggles between Simple ↔ Variable in the Variants step, recompute and clamp `activeTab` so it stays valid.
- Move the **Tax section** out of `src/components/product-edit/tabs/PricingTaxTab.tsx` and into `src/components/product-edit/tabs/InventoryShippingTab.tsx`:
  - Add a "Tax" subsection at the bottom of Inventory & Shipping with the existing controls: "Charge tax on this product" checkbox (`tax_status`) and "Tax Class" select (`tax_class`).
  - `PricingTaxTab.tsx` should keep only the Price subsection (Regular Price + Offer Price) — it now becomes a Pricing-only tab. Update `canAdvance` for the pricing step accordingly (price validity only; tax has no required validation gate).
- `canAdvance` map in `src/pages/sites/[id]/products/edit/[productId].tsx` (and `new.tsx`) must be updated to match the new step set when type is variable (skip pricing key entirely; combined inventory step still gates on SKU + stock as today).

**3. Fix the Status pill highlight in the right sidebar**
- Today: the four status pills (Active / Draft / Pending / Private) sit in a 4-column grid; the active one shows `border-primary bg-primary text-primary-foreground` but the visual emphasis is weak — user reads it as a "bottom highlight" because the pill is short and the surrounding card looks the same.
- New active style for the selected status pill: keep the filled background but switch to a stronger contrast pairing — `bg-foreground text-background` (matches the dark "Variable Product" toggle and the Publish button used elsewhere in the shell). Add a subtle outer ring (`ring-2 ring-foreground/15 ring-offset-1 ring-offset-background`) so the highlight clearly wraps the entire pill, not just the bottom edge.
- Inactive pills: keep current muted look but bump padding to `py-2` so all four pills feel like real buttons.
- Optional polish: above the pills, replace the "Status" muted-foreground label with a small badge that shows the live status icon dot (green for publish, gray for draft, amber for pending, slate for private) so the right-sidebar communicates state at a glance.

## Checklist
- [ ] Replace the tab-row in `AdvancedShell.tsx` with a numbered stepper (pending / active / completed circles + connecting lines), green for completed, primary-filled with ring for active, muted for pending; clickable to jump steps and keyboard-accessible
- [ ] Derive completion from `canAdvance(stepKey)`; connector between two completed steps turns green
- [ ] Make the steps array dynamic on `form.type`: simple = 4 steps incl. Pricing & Tax, variable = 3 steps with Pricing & Tax hidden; clamp `activeTab` when type toggles so it stays valid
- [ ] Move the Tax subsection (charge tax checkbox + tax class select) from `PricingTaxTab.tsx` into `InventoryShippingTab.tsx` (place under existing Shipping section, labeled "Tax"); leave Pricing tab with Price-only fields and update its `canAdvance` rule to ignore tax
- [ ] Update the parent edit/new pages so the `canAdvance` map matches the new step keys in variable mode (no pricing key when variable) and the variable Inventory step still gates on SKU + stock as today
- [ ] Restyle the Status pill grid in the right sidebar: active pill uses `bg-foreground text-background` with a subtle outer ring so the highlight wraps the full pill; inactive pills get a slightly larger hit area; ensure the active state is obvious at a glance
- [ ] Verify with both Simple and Variable products that: stepper adapts, Pricing tab is hidden for variable, Tax appears in Inventory tab, status pill highlight is visually clear, and Save still works end-to-end

## Acceptance
- Switching a product to Variable hides the Pricing step entirely; Tax controls appear in the Inventory & Shipping step; switching back to Simple restores all 4 steps with Tax back where users expect.
- The current step is clearly marked (filled circle + ring), completed steps turn green with a check, and pending steps are muted — no more "weak underline" feel.
- The selected Status pill in the right sidebar reads as a fully highlighted button (filled background + ring), not a thin bottom border.