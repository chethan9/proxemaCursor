---
title: Post-liftoff redirect + mixed slower messages + weighted smooth progress + Lottie confetti + site icon in celebration
status: done
priority: high
type: feature
tags: [sync, ui, polish, onboarding]
created_by: agent
created_at: 2026-04-19
position: 0
---

## Notes

Five tightly-related polish items bundled as one task — all touch the sync UX.

### 1. Post-liftoff redirect → products page

**Current:** `handleLiftoff` in `src/pages/sites/connect/[id].tsx` redirects to `/sites/${siteId}` (the coming-soon home stub).
**Change:** Redirect to `/sites/${siteId}/products` instead. Products is where users actually want to land first — they see their catalog loading in real-time with the sync banner at the top. Much better onboarding moment than a blank home page.

### 2. Message pool: mixed + slower

**Why:** Orders (~45% of sync time) and Products (~25%) dominate — users see the same 5 messages cycle 10 times. Categories/tags finish in seconds — their messages barely show.

**Fix:**
- In `src/lib/sync-messages.ts`, export a new flat pool `ALL_MESSAGES` that concatenates every aspect's pool + the general/fun pool → ~30 unique lines.
- New helper: `pickAnyMessage(tick: number): string` returns `ALL_MESSAGES[tick % ALL_MESSAGES.length]`. No aspect filtering.
- Banner uses `pickAnyMessage` instead of `pickMessage`.
- Bump banner `setInterval` from 5000ms → **8000ms** so each message lingers.

### 3. Weighted progress bar + smooth rocket motion

**Current problem:** `useActiveSync` uses `WEIGHT = 100/6` (equal weight per aspect). Reality: orders take most of the sync, categories/tags take seconds. So the bar "jumps" — stays near 0% while orders grind through, then leaps when categories/tags/coupons complete back-to-back. Rocket snaps with each jump.

**Fix A — real-world aspect weights** in `src/hooks/queries/useActiveSync.ts`:
- Replace `const WEIGHT = 100 / ASPECTS.length;` with a weight map:
  ```
  ASPECT_WEIGHTS = { orders: 45, products: 25, customers: 20, categories: 4, tags: 3, coupons: 3 }
  ```
- Accumulate progress using per-aspect weight: `progress += ASPECT_WEIGHTS[asp]` when completed, `progress += ASPECT_WEIGHTS[asp] * 0.4` when running.
- Sum of weights = 100 exactly.

**Fix B — smooth rocket animation** in `src/components/SyncProgressBanner.tsx`:
- Add local state `displayProgress` (number).
- Add `useEffect` with `requestAnimationFrame` loop: each frame ease `displayProgress` toward `data.progress` by `(target - current) * 0.05` (spring-like easing). Stop RAF when within 0.1% of target.
- Replace `data.progress` in the bar's `style={{ width }}` AND the rocket's `style={{ left }}` with `displayProgress`. They'll always match each other AND animate smoothly even when the source progress jumps.
- Keep `data.progress` for the % badge (it's OK for the number to update directly).

### 4. Celebration dialog: site icon instead of emoji

**Current:** Big 🎉 emoji in center of dialog.
**Change:** Use the existing `SiteIcon` component (from `src/components/site/SiteIcon.tsx`) rendered at `size="xl"` (or pass a large size). Needs store data (url, name) to pull favicon + letter-avatar fallback.

**Wiring:**
- `SyncCelebrationDialog` accepts a new prop `store: { id: string; name: string; url: string } | null`.
- `SyncProgressBanner` already fetches active sync for the current store — also fetch minimal store row (`id, name, url`) via a small query or pull from existing `useStores` hook. Pass to dialog.
- If `store` null (safety): fall back to the 🎉 emoji so dialog never breaks.

### 5. Lottie confetti (replace canvas-confetti)

**Why:** User says canvas-confetti looks cheap. They provided `/public/confetti.json` — a Lottie animation with glitter bursting from bottom-left AND bottom-right.

**Fix:**
- Uninstall `canvas-confetti` and `@types/canvas-confetti`.
- Install `lottie-react` (~30KB, clean API, maintained).
- In `SyncCelebrationDialog`, remove the confetti import + useEffect that fires bursts.
- Add a fixed full-viewport Lottie overlay when dialog is open:
  ```
  <div className="fixed inset-0 pointer-events-none z-[60]">
    <Lottie animationData={confettiData} loop={false} autoplay />
  </div>
  ```
  Import `confettiData` from `/public/confetti.json` via a fetch OR directly import (Next can import JSON with resolveJsonModule). Simplest: `import confettiData from "@/public/confetti.json"` (if path alias exists) OR fetch on mount.
- Lottie fills the viewport, glitter appears from bottom corners per the animation, fades on its own. No loop — plays once.
- Dialog `z-50` remains on top; overlay sits between backdrop and dialog (z-[45] for overlay, or z-[60] above dialog works since it's pointer-events-none).

**Files touched:**
- `src/pages/sites/connect/[id].tsx` — redirect target
- `src/lib/sync-messages.ts` — add ALL_MESSAGES + pickAnyMessage
- `src/components/SyncProgressBanner.tsx` — use pickAnyMessage, 8s interval, displayProgress RAF animation, fetch store for dialog
- `src/hooks/queries/useActiveSync.ts` — aspect weight map
- `src/components/SyncCelebrationDialog.tsx` — accept store prop, render SiteIcon, replace confetti with Lottie overlay
- `package.json` — remove canvas-confetti + @types/canvas-confetti, add lottie-react

## Checklist

- [ ] Change post-liftoff redirect in connect page from `/sites/${siteId}` to `/sites/${siteId}/products`
- [ ] Add flat `ALL_MESSAGES` pool (all aspect + general lines combined) and `pickAnyMessage(tick)` helper in `sync-messages.ts`
- [ ] Banner uses `pickAnyMessage`, message rotation interval bumped to 8000ms
- [ ] Replace equal-weight progress calc in `useActiveSync` with weight map: orders 45, products 25, customers 20, categories 4, tags 3, coupons 3
- [ ] Add `displayProgress` state with requestAnimationFrame spring-ease toward `data.progress` (~5% per frame); use for bar fill width AND rocket left position — rocket and bar stay perfectly synced, motion becomes smooth
- [ ] Extend `SyncCelebrationDialog` to accept `store` prop and render `SiteIcon` (large) in place of the 🎉 emoji, fall back to emoji when store is null
- [ ] `SyncProgressBanner` fetches active store row (id, name, url) and passes to `SyncCelebrationDialog`
- [ ] Uninstall `canvas-confetti` + `@types/canvas-confetti`; install `lottie-react`
- [ ] Replace canvas-confetti burst in dialog with full-viewport Lottie overlay loading `/public/confetti.json`, autoplay once, pointer-events-none, z-index above backdrop

## Acceptance

- After clicking "Launch & Go to Dashboard", user lands on the products page of the newly-connected site (not the home coming-soon)
- Banner messages rotate every 8 seconds across a ~30-line pool mixing all categories + fun lines
- Progress bar advances smoothly and proportionally — orders dominate the bar's journey, categories/tags/coupons barely move the needle
- Rocket slides smoothly alongside the bar fill, never drifting ahead or snapping, always at the same % as the bar
- Initial sync completion modal shows the site's favicon (or letter avatar) and full-screen Lottie glitter bursting from both bottom corners