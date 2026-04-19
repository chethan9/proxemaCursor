---
title: Initial sync completion celebration modal with confetti
status: todo
priority: medium
type: feature
tags: [sync, ui, onboarding, delight]
created_by: agent
created_at: 2026-04-19
position: 0
---

## Notes

When a user's FIRST sync (initial sync, `is_initial: true` on the `sync_runs.all` row) completes successfully, replace the quiet "Sync complete" toast with a full-screen celebration — centered modal + confetti burst.

**Why only initial sync:** Every webhook refresh or scheduled cron run completes syncs silently (toast is fine). But the first-ever sync is an onboarding milestone — the moment the site goes from "connecting" to "live and usable." That deserves a real moment.

**Reference mock:** User provided mock — white card with party popper icon (🎉), headline, one-line subcopy, single orange CTA. Confetti visually pours in from the top of the viewport.

**Detection logic (extend existing):**
- `src/hooks/queries/useActiveSync.ts` currently pulls the latest "all" sync_run. Add `is_initial` to the select + return it in the hook's payload.
- `src/components/SyncProgressBanner.tsx` already has the `prevRunningRef` effect that detects `running: true → false`. Branch on `is_initial`:
  - `is_initial === true` → open celebration dialog (instead of toast).
  - `is_initial === false` → existing toast path (unchanged).

**Fire-once guard:**
- On celebration trigger, set `localStorage.setItem('celebrated:' + storeId, '1')`.
- Before firing, check if key exists → skip if already celebrated. Prevents re-fire on page reload if user refreshes mid-animation.

**New component: `src/components/SyncCelebrationDialog.tsx`**
- Uses shadcn `Dialog`. Max-width ~450px, centered, rounded-2xl, solid white background with soft shadow (no dark backdrop blur — let confetti show through by using `bg-white/80 backdrop-blur-sm` on the dialog card).
- Content:
  - Large party-popper emoji 🎉 (text-5xl, centered)
  - Heading: "Your site is ready!" (text-2xl, font-semibold)
  - Subtext: "Welcome aboard. To infinity and beyond 🚀" (text-sm, text-muted-foreground)
  - Single primary CTA: "Let's go →" (full-width or centered, closes dialog)
- Entry animation: subtle scale-in from 0.9 → 1.0 with fade (shadcn Dialog default is fine, just tune duration).

**Confetti:**
- Package: `canvas-confetti` (~3KB gzipped, zero deps, already widely used).
- Fire when dialog opens: two bursts from left and right edges, angled inward, spread across a 3-second window (staggered intervals). Use vibrant palette — emerald, amber, rose, primary blue, violet. Particle count ~80-100 per burst, gravity 1, scalar 0.9 (slightly smaller particles for polish).
- Fire once on mount, no loop.

**CTA behavior:** "Let's go →" closes the dialog. Nothing else — user is already on the site page (banner was visible there). No redirect needed.

**Files touched:**
- `src/hooks/queries/useActiveSync.ts` — add `is_initial` to the select + return payload.
- `src/components/SyncCelebrationDialog.tsx` — NEW.
- `src/components/SyncProgressBanner.tsx` — branch toast vs dialog on `is_initial`; manage dialog open state + localStorage guard.
- `package.json` — add `canvas-confetti` + `@types/canvas-confetti`.

## Checklist

- [ ] Install `canvas-confetti` and `@types/canvas-confetti`
- [ ] Extend `useActiveSync` to include `is_initial` from the "all" sync_run row in its return payload
- [ ] Create `SyncCelebrationDialog` component: shadcn Dialog with party-popper emoji, "Your site is ready!" heading, "Welcome aboard. To infinity and beyond 🚀" subtext, "Let's go →" CTA
- [ ] Fire confetti burst on dialog open — two origins (left + right), vibrant 5-color palette, ~3 second duration, staggered
- [ ] In `SyncProgressBanner`, on `running: true → false` transition: if `is_initial === true` show dialog; otherwise show existing quiet toast
- [ ] Add localStorage fire-once guard keyed by storeId so page reload doesn't re-trigger the celebration

## Acceptance

- First sync completing on a brand-new site opens a centered modal with party popper, heading, and "Let's go →" CTA while confetti rains from both sides
- Subsequent syncs (webhook/cron) still use the quiet toast — no modal, no confetti
- Refreshing the page after celebration does NOT re-fire the confetti