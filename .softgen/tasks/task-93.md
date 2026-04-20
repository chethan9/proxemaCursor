---
title: Floating scroll-to-top/bottom button
status: done
priority: medium
type: feature
tags: [ui, layout, navigation]
created_by: agent
created_at: 2026-04-20
position: 93
---

## Notes
Add a small floating button pinned to the bottom-right corner, visible ONLY inside the authenticated app shell (AppLayout). Must NOT appear on auth pages (`/auth/*`), onboarding/connect pages (`/sites/connect/*`), or any page that doesn't use AppLayout.

**Behavior:**
- Detect scroll position of the main scroll container (the scrollable area inside AppLayout — check `SidebarInset` / main content in `src/components/layout/AppLayout.tsx`).
- Hidden entirely when page has no scrollable overflow (content fits viewport).
- When scrolled down (not at top): show **up arrow**, click scrolls smoothly to top.
- When at top AND page has more content below: show **down arrow**, click scrolls smoothly to bottom.
- Smooth scroll behavior, small unobtrusive size (~36-40px), subtle shadow, fixed position bottom-right with adequate spacing from edges (~24px).
- Respect sidebar — positioning should work whether sidebar is collapsed or expanded (fixed to viewport, not shifted).

**Implementation placement:**
- Create component under `src/components/layout/` (e.g. ScrollToTopButton).
- Mount it inside `src/components/layout/AppLayout.tsx` so it auto-appears on every AppLayout page and is absent from auth/onboarding pages by design.
- Use ResizeObserver + scroll listener on the scrollable container to detect scroll state and overflow presence.

**Styling:** Use existing theme tokens — rounded button, `bg-background` with border OR `bg-primary` subtle variant, icon from lucide-react (`ArrowUp` / `ArrowDown` or `ChevronUp` / `ChevronDown`). Smooth fade in/out transition.

## Checklist
- [ ] Floating button component: fixed bottom-right (~24px from edges), ~36-40px size, rounded, subtle shadow, smooth fade transition
- [ ] Detects scrollable container inside AppLayout and listens for scroll + resize events
- [ ] Hidden when no scroll overflow (content fits viewport)
- [ ] Shows upward arrow when scrolled down; click smooth-scrolls to top
- [ ] Shows downward arrow when at top with content below; click smooth-scrolls to bottom
- [ ] Mounted inside AppLayout so it appears on all app pages automatically
- [ ] Absent on auth pages (`/auth/*`), onboarding/connect pages, and any page not wrapped in AppLayout

## Acceptance
- Button appears on dashboard, sync-runs, explore, settings — anywhere inside the app shell.
- Button does NOT appear on login, signup, forgot-password, or site connect/onboarding pages.
- On a long list page, scrolling down reveals the up-arrow; clicking it returns smoothly to top, where it switches to a down-arrow.
- On a short page with no scroll, the button is not visible.