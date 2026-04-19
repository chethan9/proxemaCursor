---
title: Fix WordPress authorization return flow (refresh + branding)
status: done
priority: high
type: bug
tags: [wordpress, auth, media, branding]
created_by: agent
created_at: 2026-04-19
position: 71
---

## Notes

Two issues with the WordPress media authorization flow visible in `EditSiteDialog`:

**1. Page doesn't refresh after authorization**
After user clicks "Authorize WordPress" on the WP admin page and approves, they return to the app but the "Not connected" pill still shows. Data is saved to DB (credentials stored), but the UI doesn't reflect it.

Evidence from screenshots: WP auth page shows redirect URL `/api/wordpress/app-password-callback` and reject URL pointing back to `/projects`. After approval the stores query isn't invalidated on return, so cached stale data shows "Not connected".

Root cause: The callback handler at `src/pages/api/wordpress/app-password-callback.ts` redirects to `/projects?wp_connected=1&edit_store={id}`, but the `useEffect` in `src/pages/projects/index.tsx` that handles those query params may be racing with the stores query load, or the dialog is reopening before the invalidated query refetches. Need to verify: (a) callback actually redirects to the right URL, (b) query invalidation forces a refetch before dialog reopens, (c) the reopened dialog reads fresh `store` prop not stale.

**2. App name shows "WooSync Media" instead of "Proxima"**
The default `appName` in `buildWpAppPasswordUrl` (`src/lib/woocommerce-auth.ts`) is `"WooSync Media"`. Also the help text in `EditSiteDialog.tsx` says "you grant WooSync media-library access". Branding should be **Proxima** everywhere user-facing.

Files involved:
- `src/lib/woocommerce-auth.ts` — default `appName` value
- `src/components/project/EditSiteDialog.tsx` — helper text under Authorize button
- `src/pages/api/wordpress/app-password-callback.ts` — verify redirect target + query params
- `src/pages/projects/index.tsx` — verify `useEffect` that reads `wp_connected` + `edit_store` query and reopens dialog with refreshed data

## Checklist

- [x] Default WP application name changed from "WooSync Media" to "Proxima" in the auth URL builder
- [x] Dialog helper text under "Authorize WordPress" button reads "Opens a WordPress page where you grant Proxima media-library access. You'll be redirected back here."
- [x] All other user-facing "WooSync" references in Edit Site dialog changed to "Proxima" (check AlertCircle warning text, dialog description)
- [x] After returning from WP approval, the Edit Site dialog reopens automatically showing "Connected as {username}" pill without manual refresh
- [x] After authorization, stores data is refetched (not served from cache) so the dialog reads fresh credentials
- [x] Success toast "WordPress connected" appears once on return, and query params are cleared from URL so page refresh doesn't re-trigger
- [x] Rejected flow (user clicks "No, I do not approve") shows error toast and returns to same dialog in the non-connected state
- [x] Verified end-to-end on a real site: authorize → approve → land back on Projects page → dialog reopens → shows connected pill with WP username

## Acceptance

- User clicks "Authorize WordPress", approves on WP, lands back in the Edit Site dialog with the green "Connected as {username}" pill visible, no manual refresh needed.
- The WP authorization page shows application name "Proxima" (not "WooSync Media").
- No "WooSync" text visible anywhere in the Edit Site dialog.