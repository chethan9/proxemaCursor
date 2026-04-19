---
title: Onboarding flow polish - lock nav, rename app, sync UX
status: todo
priority: high
type: bug
tags: [onboarding, ux, sync]
created_by: agent
created_at: 2026-04-19T21:55:00Z
position: 74
---

## Notes

Three related fixes for the site onboarding/sync experience.

**Context files:**
- `src/pages/sites/connect/[id].tsx` — onboarding page (uses AppLayout, has full sidebar)
- `src/lib/woocommerce-auth.ts:39` — `appName = "WooSync"` for WooCommerce OAuth
- `src/pages/sites/connect/[id].tsx:72` — `app_name=WooSync` hardcoded in WP authorize URL builder
- `src/components/SyncProgressBanner.tsx` — shows during sync, no completion toast, no access restriction
- `src/hooks/queries/useActiveSync.ts` — returns `running: false` once sync completes

**Issue 1 — Navigation lock during onboarding:**
Connect page wraps in `AppLayout` which exposes full sidebar. Users can accidentally click away before credentials land or before liftoff is triggered, orphaning the flow. Lock nav from start of flow through "Ready for Liftoff" screen. Once user clicks "Launch & Go to Dashboard" (liftoff), normal nav resumes because sync runs in background and the progress banner handles visibility.

Approach: create a minimal layout variant (no sidebar, just logo + branding) for the connect page, used during stages `woo` / `wp` / `estimating` / `liftoff`. Keep the existing dismiss path after liftoff click (user is redirected to `/sites/{id}` by current code).

**Issue 2 — Rebrand to Proxima:**
Two places still say "WooSync":
- `src/lib/woocommerce-auth.ts` line 39: `appName = "WooSync"` (default param in `buildWooCommerceAuthUrl`)
- `src/pages/sites/connect/[id].tsx` line 72: `&app_name=WooSync` in the manually-built WP authorize URL
Change both defaults to `"Proxima"`. Verify no other "WooSync" literals remain that should flip.

**Issue 3 — Sync UX + completion toast:**
Decision: keep data views accessible during sync (blocking would frustrate users with large stores). Progress banner already signals ongoing work. Add gentle per-aspect hint in table empty states ("Products still syncing…") only when the relevant aspect is currently running via `useActiveSync`.

Completion toast is missing. `SyncProgressBanner` should track the previous `running` state (via `useRef`) and fire a one-time success toast when it transitions `true → false`. Also reset `dismissed` state on new sync starts (already partially handled — verify `useEffect` dependency). Confirm toast dismissal works: the toast itself uses `use-toast` which auto-dismisses by default — verify the banner fully unmounts (it does — returns null when `!running`).

## Checklist

- [ ] Lock sidebar/navigation during onboarding: render connect page without full `AppLayout` sidebar (minimal header with logo only) through all stages until user clicks "Launch & Go to Dashboard"
- [ ] On the minimal onboarding layout, suppress the `SyncProgressBanner` too (already guarded for `/sites/connect/` — verify still works)
- [ ] Change WooCommerce OAuth `appName` default from "WooSync" to "Proxima" in `src/lib/woocommerce-auth.ts` so the WooCommerce authorize screen shows "Proxima"
- [ ] Change `app_name=WooSync` to `app_name=Proxima` in the WP authorize URL builder inside `src/pages/sites/connect/[id].tsx`
- [ ] Grep the codebase for any remaining user-facing "WooSync" strings and rename to "Proxima" (skip internal code/package identifiers)
- [ ] Add completion toast in `SyncProgressBanner`: track previous `running` via `useRef`, fire "✨ Sync complete — your store is live on Proxima" toast on `true → false` transition, include a subtle variant (success)
- [ ] Reset `dismissed` state when a new sync starts (already done on `running` change — verify covers all cases including aspect transitions)
- [ ] Add per-aspect syncing hint in data explorer empty states: when `useActiveSync` reports the current aspect is syncing (products/orders/customers/categories/tags), show "Still syncing… partial data shown" inline at top of the list instead of treating it as empty

## Acceptance

- During onboarding, the sidebar/nav is hidden and the user can't accidentally navigate away until they click "Launch & Go to Dashboard"
- The WooCommerce authorize screen and WP application password screen both show "Proxima" as the requesting app
- When initial sync completes, a success toast appears once; the banner disappears cleanly; data views that were empty during sync now show the synced records with no stale "syncing" indicator