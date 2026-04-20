---
title: Scoped sync progress to Projects page
status: todo
priority: low
type: feature
tags: [sync, ui, stability, cleanup, deferred]
created_by: agent
created_at: 2026-04-20T00:35:00Z
position: 84
---

## Notes

**DEFERRED** (2026-04-20) — current global `SyncProgressBanner` is stable after recent fixes. Revisit only if freezes return or if UX feedback asks for a cleaner progress surface.

Sync progress UI is currently mounted site-wide via `SiteLayout` (`SyncProgressBanner.tsx`). Despite debouncing and navigation guards, the polling + multi-query invalidation under navigation transitions keeps causing freezes. Simpler, safer approach: remove global banner + all cross-page toasts; show progress only on the Projects list page as an inline row-level indicator.

Also two related fixes:
1. **WooCommerce API key cleanup on delete** — `delete.ts` attempts to DELETE `/wp-json/wc/v3/webhooks/{id}` but never deletes the WooCommerce API key (consumer key/secret). The key row stays inside WooCommerce forever. Add a delete call against `/wp-json/wc/v3/...` for the API key before removing the store. Note: WooCommerce does not expose a REST endpoint to delete keys by consumer_key; must query `/wc/v3/settings/advanced/woocommerce_api_consumer_key` alt — actually the correct approach is to track `woo_key_id` when credentials are issued (OAuth callback stores it) and then DELETE `/wc/v3/system_status/tools` → no, the real endpoint is not public. Fallback: at minimum, warn the user in the delete confirmation that WooCommerce keys should be revoked manually if OAuth was not used. For OAuth-issued keys, store `woo_key_id` returned in callback and call `DELETE /wc/v3/keys/{id}` via internal WP admin API — but this requires WP admin session. Simplest reliable path: store the consumer_key_id if available, attempt deletion via `/wp-json/wc/v3/` admin call with the stored consumer credentials themselves; log failure silently and continue store deletion.

2. **Background sync toast removal** — all toasts fired from `SyncProgressBanner` for background site completions must go. User sees status inline in Projects list only.

## Checklist

- [ ] Remove `SyncProgressBanner` import + render from `src/components/layout/SiteLayout.tsx` so sync UI no longer mounts on any `/sites/*` route
- [ ] Delete `SyncProgressBanner` usage anywhere else it's mounted (grep for `SyncProgressBanner`)
- [ ] Keep `SyncCelebrationDialog` only where it still matters — if only tied to banner, remove globally; if shown on connect completion, leave on `/sites/connect/[id]` page only
- [ ] Remove all cross-page completion toasts: background toasts + current-site completion toast inside `SyncProgressBanner`. Either simplify the banner to only work when mounted on Projects, or drop the banner file entirely and build inline progress in Projects list
- [ ] Projects list inline progress (`src/pages/projects/index.tsx` + `src/components/project/SitesTable.tsx`):
  - [ ] Under each row that has an active sync, show a slim animated progress bar (emerald gradient, shimmer) with percentage + current aspect label (e.g. "Syncing products… 42%")
  - [ ] Use `useAllActiveSyncs` (already polls every 2.5s) to drive per-row progress — match by `store_id`
  - [ ] When sync completes, row smoothly transitions to show updated `last_sync_at` and status badge — no toast, no dialog
  - [ ] Optional: small "just synced" pulse/fade on the row for 3s after completion (pure CSS animation, no state elsewhere)
- [ ] WooCommerce API key cleanup in `src/pages/api/stores/[storeId]/delete.ts`:
  - [ ] Before webhook cleanup block, attempt to list `/wp-json/wc/v3/` keys via `GET /wc/v3/` — WooCommerce does not list keys via REST, so instead: document this limitation in the endpoint comments, and add UI warning to `EditSiteDialog` Danger Zone: "⚠ You'll need to manually revoke the API keys in WooCommerce → Advanced → REST API after deletion"
  - [ ] For OAuth-issued connections, check if `stores` table has a `woo_key_id` column; if yes, DELETE via `/wp-json/wc/v3/` admin endpoint using stored credentials. If column missing, add migration `woo_key_id INT NULL` on stores and populate it in `src/pages/api/woocommerce/callback.ts` when Woo returns `key_id` in callback payload
  - [ ] Log result into response JSON alongside `webhooks_removed` as `api_key_removed: boolean`
- [ ] Verify `SiteLayout.tsx` no longer references `SyncProgressBanner`, `useAllActiveSyncs`, or any toast-on-completion logic
- [ ] Manual test: add site → watch progress in Projects list → delete a syncing site mid-run → confirm no freeze and no stale state
- [ ] Manual test: close tab during sync → reopen → Projects list re-reads progress from `useAllActiveSyncs` and resumes inline bar

## Acceptance

- No sync banner or toast appears on any `/sites/*` route; navigation between site pages never freezes during a sync
- Projects list shows inline per-row progress bar + current aspect for any active sync, updates live, and silently disappears when sync completes (row just updates its Last Sync + status)
- Deleting a site removes WooCommerce webhooks AND either removes the API key or clearly warns the user to revoke it manually; response JSON reports what was cleaned up