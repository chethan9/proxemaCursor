---
title: Sync banner redesign - animated rocket on bar, fixed-width message, generic progress pool
status: done
priority: medium
type: feature
tags: [sync, ui, polish]
created_by: agent
created_at: 2026-04-19
position: 0
---

## Notes

Two refinements to the live sync experience:

**1. Generic progress message pool** — User provided 15 neutral, product-agnostic progress phrases ("Getting things ready…", "Warming things up…", "Making good progress…", "Halfway there…", "Picking up speed…", "Almost in place…", "Just a few more moments…", "Wrapping things up…", "Finishing touches…", "Nearly there…", "Almost ready…", "Just about done…", "Ready any second now…", etc.). These should power any generic progress UI that isn't tied to a specific aspect — primarily the connect page's "Scanning store inventory" step caption and the default fallback when sync hasn't picked an aspect yet. Add them as `SYNC_MESSAGES.progress` in `src/lib/sync-messages.ts`. On the connect page (`src/pages/sites/connect/[id].tsx`), when `stage === "estimating"`, replace the static "Counting products, orders, and customers…" with a rotating phrase from this pool (change every 2.5s with fade transition).

**2. Sync banner layout redesign** — The fun per-aspect message currently sits between the aspect label and the progress bar, so as text changes the bar shifts right/left = jittery. Fix by reordering into three regions:

- **Left (fixed, compact):** `[pulsing dot] Syncing · [aspect icon] [Aspect name]` — no text flow here.
- **Center (flex-1):** Progress bar (narrower than now since left/right are constrained).
- **Right (fixed width ~220px):** `[fun message truncated w-52] · Elapsed 3m 37s · 90% · [X close]` — fun message gets max-width and `truncate`, so its width is capped. No more layout shift.

**3. Animated rocket riding the progress bar** — Inside the progress bar track, overlay an absolutely-positioned `Rocket` icon (`lucide-react`). Its `left: X%` is driven by a **time-based creep**, not the records-based progress:

- Formula: `rocketPct = Math.min((elapsed_seconds / 300) * 100, 99)` — 5 minutes = 99%, capped there.
- After the "all" sync run completes, snap to 100% then the banner unmounts normally.
- The real records-based `progress` value still fills the emerald gradient bar behind the rocket, so users see both: green fill = actual data progress, rocket = "we're still alive and moving" time-based visual.
- Rocket should wiggle slightly (subtle CSS `@keyframes` — tiny rotate + translateY bounce on a 2s loop) so it feels alive even if both values are momentarily static.
- Use `transition-[left] duration-1000 ease-linear` so position updates smoothly as `useActiveSync` polls every 2s.

**4. Sync-messages file** — Already has products/orders/customers/categories/tags/coupons/general pools from task-76. Add a new `progress` pool (the 15 generic phrases). `pickMessage(aspect, tick)` unchanged; new helper `pickProgressMessage(tick)` returns from the generic pool.

**Files touched:**
- `src/lib/sync-messages.ts` — add `progress` pool + `pickProgressMessage` helper.
- `src/components/SyncProgressBanner.tsx` — full restructure: left fixed, center bar (narrower), right fixed-width region; add animated rocket overlay with time-based position; pulsing dot replaces rocket icon on left.
- `src/pages/sites/connect/[id].tsx` — in the "estimating" stage, render rotating message from `pickProgressMessage(tick)` instead of the static line. Needs local `tick` state and a 2.5s interval while `stage === "estimating"`.

**Acceptance:**
- Banner width doesn't shift as messages cycle — progress bar stays anchored.
- Rocket icon visibly travels left-to-right on the bar during a sync, wiggling gently, caps at 99% after 5 minutes.
- Fun message on the right side truncates with ellipsis rather than pushing layout.
- Connect page "Scanning store inventory" caption rotates through the 15 generic progress phrases.

## Checklist

- [ ] Add `progress` message pool (15 generic phrases) + `pickProgressMessage` helper in `src/lib/sync-messages.ts`
- [ ] Rebuild `SyncProgressBanner` with 3-region layout (fixed left · flex bar · fixed right)
- [ ] Add animated rocket overlay on progress bar with time-based 5min creep, wiggle keyframes, caps at 99%
- [ ] Replace rocket icon on left side with a small pulsing emerald dot
- [ ] Fixed-width (~w-52) right-side fun message with truncation so layout doesn't jitter
- [ ] Rotate generic progress messages on connect page "Scanning store inventory" caption every 2.5s

## Acceptance

- Progress bar position no longer shifts as fun messages cycle
- Rocket travels visibly across the bar, wiggling, capped at 99% after 5min
- Connect page estimating caption cycles through the 15 new generic phrases