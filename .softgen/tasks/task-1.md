---
title: Edit Site dialog — add WordPress media authorization
status: done
priority: high
type: feature
tags: [sites, wordpress, media, auth]
created_by: agent
created_at: 2026-04-19
position: 1
---

## Notes
The Edit Site dialog (`src/components/project/EditSiteDialog.tsx`) currently only handles WooCommerce OAuth (consumer key/secret). Media browsing/upload needs a separate WordPress Application Password — today users have to discover that flow elsewhere (currently lives on the connect page).

**Goal:** Surface WordPress media authorization alongside WooCommerce credentials in the Edit Site dialog, so it's clear the store has TWO connections that matter:
1. WooCommerce API (products, orders, customers) — existing
2. WordPress core (media library, uploads) — new section

**Existing infrastructure to reuse:**
- Callback handler already exists: `src/pages/api/wordpress/app-password-callback.ts` — saves `wp_username` + `wp_app_password` to `stores` table
- Store fields: `wp_username`, `wp_app_password` (already in DB schema)
- WP authorize URL pattern: `{site_url}/wp-admin/authorize-application.php?app_name=WooSync&success_url={callback}&state={storeId}`

**UX design:**
- Split the dialog into two clearly-labeled sections: "WooCommerce API" and "WordPress Media Access"
- WordPress section shows:
  - Status pill: "Connected as {wp_username}" (green) or "Not connected" (muted)
  - If connected: show username, last connected date, "Re-authorize" + "Disconnect" buttons
  - If not connected: explainer text + "Authorize WordPress" button
- Authorize button redirects to WP app password flow with state=storeId, returns to callback, then back to the site
- Disconnect action clears `wp_username` and `wp_app_password` in DB with confirmation
- Inline warning if user has WooCommerce connected but not WordPress: "Media library requires WordPress authorization"

**Scope files:**
- `src/components/project/EditSiteDialog.tsx` — add WordPress section, restructure into two cards
- `src/lib/woocommerce-auth.ts` — add `buildWpAppPasswordUrl()` helper if not present
- `src/services/storeService.ts` — add `disconnectWpCredentials(storeId)` method
- Keep existing WooCommerce OAuth behavior unchanged

**Out of scope:**
- Touching the connect page flow
- Changing the callback route
- The media picker itself

## Checklist
- [x] Dialog restructured: "WooCommerce API" section (existing) + "WordPress Media Access" section (new), clearly separated
- [x] WordPress section shows connection status pill with username when connected
- [x] "Authorize WordPress" button redirects to WP app password flow with correct return URL
- [x] When connected, shows "Re-authorize" and "Disconnect" actions
- [x] Disconnect requires confirmation, clears credentials, refreshes dialog state
- [x] Inline hint explains media library requires WP auth (shown only when WP not connected)
- [x] Success toast + refresh when user returns from WP auth callback
- [x] Dialog height remains comfortable — both sections fit without excessive scroll

## Acceptance
- Opening Edit Site for a store with WP connected shows "Connected as username" in the WordPress section.
- Clicking "Authorize WordPress" from the dialog completes the flow and returns user to the site with credentials saved.
- Disconnecting WP does not affect WooCommerce credentials.