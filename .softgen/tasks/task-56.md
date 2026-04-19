---
title: WP Application Password OAuth capture in site connect
status: todo
priority: urgent
type: feature
tags: [auth, wordpress, media, oauth]
created_by: agent
created_at: 2026-04-19
position: 56
---

## Notes
To upload product images to WooCommerce media library (`wp/v2/media`), we need WordPress REST API auth, separate from WooCommerce consumer keys. Instead of asking users to paste credentials manually, use WordPress's built-in **Application Password Authorization Endpoint** (`/wp-admin/authorize-application.php`) — the same OAuth-style pattern we already use for WooCommerce consumer keys.

**Flow (mirrors existing Woo OAuth flow):**
1. User finishes Woo OAuth (existing flow — keys captured via `/api/woocommerce/callback`).
2. Connect wizard immediately starts WP authorize step: redirect user to `{store_url}/wp-admin/authorize-application.php?app_name=WooSync&app_id={site_uuid}&success_url={our_callback}&reject_url={our_callback}?rejected=1`.
3. User sees WP's native "Authorize WooSync?" screen, clicks Approve.
4. WP redirects back to our callback with query params `site_url`, `user_login`, `password` (the app password).
5. Our callback stores `wp_username` + `wp_app_password` on the `stores` row, then returns the user to the connect wizard, advancing to webhooks/sync steps.
6. If user clicks Reject or the WP instance blocks this endpoint, fall back to manual-entry UI (username + app password fields + deep link to `/wp-admin/profile.php#application-passwords-section` + "Test & Save" button).

**Schema additions (stores table):** `wp_username text`, `wp_app_password text` (encrypted at rest).

**New callback endpoint:** `src/pages/api/wordpress/app-password-callback.ts` — receives `site_url`, `user_login`, `password`; matches store by `site_url`; saves credentials; redirects to connect wizard.

**Connect flow update (`src/pages/sites/connect/[id].tsx`):** Insert new step "WordPress Media Access" between creds and webhooks. Shows:
- Primary: large button "Authorize via WordPress" that opens the authorize URL in the same tab
- Secondary: collapsed "Having trouble? Enter credentials manually" link that expands to username + app password inputs with a "Test & Save" button (hits `/api/stores/{id}/test-wp-media`)
- Skip option: "Skip for now — I'll set this up later" (images fall back to Supabase Storage until added)

**Test endpoint (`/api/stores/[storeId]/test-wp-media`):** Validates credentials against `{store_url}/wp-json/wp/v2/media?per_page=1` with Basic Auth, returns `{ok, status, message}`.

**Site settings page (`src/pages/sites/[id]/settings.tsx`):** "WordPress Media Access" section with status indicator (green if valid, amber if missing/invalid), "Re-authorize" button (re-runs the OAuth flow), and "Enter manually" fallback.

**Edit site dialog (`src/components/project/EditSiteDialog.tsx`):** Same section with same actions for super admins.

## Checklist
- [ ] Add `wp_username` and `wp_app_password` columns to `stores` table via SQL migration (encrypted)
- [ ] Build `/api/wordpress/app-password-callback` endpoint that receives WP authorize-application response and saves to store row
- [ ] Build `/api/stores/[storeId]/test-wp-media` endpoint validating credentials against `wp/v2/media`
- [ ] Add "WordPress Media Access" step to connect flow between creds and webhooks with primary Authorize button, manual-entry fallback, and Skip option
- [ ] Handle authorize-rejected case by surfacing manual entry with friendly message
- [ ] Add "WordPress Media Access" section to site settings with status indicator, Re-authorize, and manual edit
- [ ] Add same section to Edit Site dialog for super admins
- [ ] Surface missing-credentials warning on site home dashboard when unset

## Acceptance
- User completing fresh site connect clicks one "Authorize" button, approves in WP, and lands back with credentials saved automatically
- If authorize endpoint fails or is blocked, user can fall back to manual entry without leaving the flow
- Existing sites can re-authorize or edit credentials from site settings
- Test endpoint returns clear success/failure with reason (401/404/network)