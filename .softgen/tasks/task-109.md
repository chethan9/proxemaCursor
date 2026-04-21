---
title: Confetti celebration on welcome screen
status: done
priority: medium
type: feature
tags: [ui, onboarding, delight]
created_by: agent
created_at: 2026-04-21T03:55:00Z
position: 109
---

## Notes

The welcome/liftoff screen on `src/pages/sites/connect/[id].tsx` currently shows "Welcome to Proxima — Your site is ready" with just a rocket emoji and spinner. User wants the confetti animation (`public/confetti.json`, Lottie format) to play once on mount to celebrate completed onboarding.

### Implementation
- Install `lottie-react` (currently not in package.json — verified)
- Load `/confetti.json` via fetch or import
- Render full-screen overlay behind the welcome card, auto-play once, non-looping
- Respect `prefers-reduced-motion` — if reduced motion, skip animation entirely
- Animation is decorative only (aria-hidden)

### File locations
- Welcome screen: `src/pages/sites/connect/[id].tsx` (search for "Welcome to Proxima")
- Asset already in `public/confetti.json`

## Checklist

- [ ] Install `lottie-react` package
- [ ] Add `Confetti` component that loads `/confetti.json` and plays once, full-screen, behind content, pointer-events-none
- [ ] Honor `prefers-reduced-motion: reduce` — render nothing
- [ ] Wire into welcome screen only (not on every connect page visit — only when the liftoff/completed state is shown)
- [ ] Verify: completing onboarding plays confetti once; refreshing the welcome screen does not replay; reduced-motion users see no animation

## Acceptance

- Finishing onboarding triggers a single confetti burst over the welcome screen.
- No repeat plays on re-renders.
- No animation for users with reduced-motion preference.