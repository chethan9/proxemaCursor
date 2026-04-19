---
title: Banner persistence + rocket idle animation + confetti prefetch + post-celebration data refresh
status: done
priority: high
type: feature
tags: [sync, ui, polish, ux]
created_by: agent
created_at: 2026-04-19
position: 0
---

## Notes

Four tightly-related polish items — all address UX gaps the user observed during a live sync.

### 1. Banner progress persists across page nav + browser refresh

**Current:** `displayProgress` state starts at 0 on every mount. When user navigates between pages (Orders → Products), the banner remounts via the layout, RAF re-animates from 0 up to current `data.progress`. Feels like progress reset.

**Fix:** Persist `displayProgress` to `localStorage` under key `sync-display-progress:${storeId}`.
- On banner mount, read stored value → initialize `displayProgress` state with it (instead of `0`).
- On every RAF update, throttle-write the current value back to localStorage (e.g., write at most every 500ms).
- When sync ends (`running → false`), delete the key.
- Result: bar + rocket appear where they should from the instant the banner renders, even after browser refresh.

### 2. Rocket always-alive animation (bobble + pulsing trail)

**Current:** Rocket is static when `displayProgress` equals source. Feels frozen between aspect transitions.

**Fix A — idle bobble:** Add a CSS keyframe `rocket-bob` (1.8s ease-in-out infinite, `translateY: 0 → -1.5px → 0`). Apply to the rocket icon wrapper so it always floats subtly, independent of progress motion.

**Fix B — pulsing particle trail:** The three trailing dots currently have static opacity. Add a staggered fade-pulse keyframe — each dot animates opacity 0.3 → 1 → 0.3 on a 0.9s loop, offset by 0.15s each. Looks like rocket exhaust pulsing.

**Fix C — smooth stage transitions:** Current RAF ease factor `0.05` is slow (~40 frames to close gap). When progress jumps big (e.g., orders 18% → 45% when aspect completes), it feels laggy but correct. Keep 0.05 but make max step at least 0.3% per frame to prevent arbitrarily slow finish. Math: `next = cur + max(diff * 0.05, sign(diff) * 0.3)` when within 5%.

### 3. Confetti fires 1s before dialog card, prefetched at banner mount

**Current:** Dialog opens → Lottie mounts → fetches `/confetti.json` → parses → animates. ~2s delay before confetti visible. Dialog card is already showing at that point, so confetti feels "late."

**Fix:**
- **Prefetch:** In `SyncProgressBanner`, fetch `/confetti.json` on mount (regardless of celebration state) and cache the parsed JSON in component state (or module-level cache). Pass to dialog as prop.
- **Stagger:** Celebration trigger sets two states: `overlayOpen: true` immediately, `cardOpen: true` after `setTimeout(800)`.
- `SyncCelebrationDialog` receives `overlayOpen` + `cardOpen` separately:
  - Lottie overlay renders when `overlayOpen && animationData` — starts instantly with pre-loaded data.
  - Shadcn `<Dialog>` renders when `cardOpen`.
- Result: glitter starts bursting ~1s before the "Your site is ready!" card fades in. Feels like a ta-da moment.

### 4. Post-celebration data refresh (invalidate store queries)

**Current:** User clicks "Let's go →" → dialog closes → products/orders pages still show cached empty results from before sync completed. User sees "No orders found" despite having just synced 124 products.

**Fix:** In `SyncProgressBanner`, when the celebration dialog's `onOpenChange(false)` fires OR when sync transitions `running → false` (also for non-initial syncs), call `queryClient.invalidateQueries` with prefix keys:
```
qc.invalidateQueries({ queryKey: ["orders"] });
qc.invalidateQueries({ queryKey: ["products"] });
qc.invalidateQueries({ queryKey: ["taxonomy"] });
qc.invalidateQueries({ queryKey: ["webhooks"] });
qc.invalidateQueries({ queryKey: ["sync-runs"] });
```
All store-scoped queries use these prefixes, so all relevant pages refetch fresh data transparently.

Use `useQueryClient()` hook from `@tanstack/react-query`.

**Files touched:**
- `src/components/SyncProgressBanner.tsx` — localStorage read/write for displayProgress, prefetch confetti JSON, stagger overlay vs dialog open, invalidate queries on sync-end + dialog-close, rocket bobble + trail pulse CSS
- `src/components/SyncCelebrationDialog.tsx` — accept `animationData` as prop (no longer fetches), split `open` into overlay vs card timing

## Checklist

- [ ] Persist banner `displayProgress` to `localStorage` keyed `sync-display-progress:${storeId}`, read on mount to seed state, throttle-write on RAF updates, delete when sync ends
- [ ] Bar + rocket appear where they should from the instant banner mounts (no reset to 0) even after page navigation or browser refresh
- [ ] Rocket icon wrapper has `rocket-bob` keyframe animation (~1.8s infinite, ±1.5px Y translate) so rocket always floats subtly
- [ ] Three trailing particle dots fade-pulse on staggered 0.9s loop (0.3 → 1 → 0.3 opacity, 0.15s stagger) so trail looks like living exhaust
- [ ] RAF ease floor — ensure minimum step of 0.3% per frame when diff is small so rocket always keeps moving visibly
- [ ] `SyncProgressBanner` prefetches `/confetti.json` on mount and caches parsed data in state; passes `animationData` prop to `SyncCelebrationDialog`
- [ ] Celebration trigger opens Lottie overlay immediately but delays dialog card mount by ~800ms — confetti bursts first, then card fades in
- [ ] `SyncCelebrationDialog` no longer fetches JSON internally; receives `animationData` + separate `overlayOpen` and `cardOpen` props
- [ ] On sync completion transition (`running: true → false`) AND on celebration dialog close: invalidate React Query prefixes for `["orders"]`, `["products"]`, `["taxonomy"]`, `["webhooks"]`, `["sync-runs"]` so user sees fresh data without manual refresh

## Acceptance

- Navigating between Orders ↔ Products ↔ Categories during an active sync keeps the progress bar and rocket exactly where they were — no reset to 0
- After browser refresh mid-sync, banner resumes at the last persisted progress value, not 0
- Rocket visibly bobbles up/down even when progress is flat, and trail dots pulse like exhaust — banner never looks frozen
- On initial sync completion: confetti glitter bursts from bottom corners for ~1s before the "Your site is ready!" card fades in on top
- After clicking "Let's go →", whichever page the user lands on (products, orders, etc.) shows fresh data with no manual refresh needed