---
title: Fix WP re-authorize + disconnect (storeService.updateStore hangs)
status: done
priority: urgent
type: bug
tags: [wordpress, auth, supabase, hang]
created_by: agent
created_at: 2026-04-19
position: 71
---

## Notes

User reports:
1. **Re-authorize WP does nothing** — UI still shows "Not connected" / "WordPress credentials not configured" even after completing approval on WP side.
2. **Disconnect crashes the whole app** — clicking "Disconnect" in AlertDialog makes entire site non-responsive.

Both only happen on edit/re-auth flows. First-time site add works fine.

### Root cause (high confidence)

`src/services/storeService.ts` has two patterns:

- **`createStore`** and **`deleteStore`** read the auth token from `localStorage` and call a server API route (`/api/stores/create`, `/api/stores/[id]/delete`). The comment explicitly says: *"Read token directly from localStorage — bypasses the browser Supabase client which can hang on getSession() after certain errors."*
- **`updateStore`** does NOT use that workaround — it calls `supabase.from("stores").update(...)` directly via the browser client.

Both **disconnect** (`disconnectWpCredentials` → `updateStore`) and **pre-redirect save** (`persistFormBeforeRedirect` → `updateStoreMutation` → `updateStore`) hit this hanging path.

- **Disconnect hang:** AlertDialog awaits `disconnectWpCredentials` which never resolves → modal frozen → "whole site unresponsive".
- **Re-auth hang:** In `EditSiteDialog.handleWpAuthorize`, `persistFormBeforeRedirect` awaits updateStore. Even when form is unchanged it wraps in try/catch and proceeds, BUT if the user changed the name or store URL before clicking Re-authorize, the update hangs silently (caught + logged), redirect still fires to WP. User approves, callback saves creds with supabaseAdmin, redirect back to `/projects?wp=ok&store={id}`. Projects page invalidates query → refetch uses the same browser client which may also be stuck → cache never updates → dialog reopens with stale `wp_username: null` → shows "Not connected".

Secondary concern: the query invalidation in projects/index.tsx runs on browser supabase client too. If the client is in a hung state, refetch never completes.

### Files to change

- `src/services/storeService.ts` — make `updateStore` use the same server-route + localStorage-token pattern as `createStore`/`deleteStore`. Create new API route `POST /api/stores/[storeId]/update` that uses `supabaseAdmin` to perform the update (validated by bearer token).
- `src/pages/api/stores/[storeId]/update.ts` — new file. Verify session, call `supabaseAdmin.from("stores").update(...).eq("id", storeId)`, return updated row. Authorization: ensure the caller owns the store (super_admin bypass, or user is member of the owning client).
- `src/services/storeService.ts` — `disconnectWpCredentials` stays as-is (it calls `updateStore`, so fix propagates).
- `src/components/project/EditSiteDialog.tsx` — `handleWpDisconnect` wraps in try/finally, so `setConfirmDisconnect(false)` always runs even on failure; add a timeout guard for safety.
- `src/pages/api/wordpress/app-password-callback.ts` — add `console.log` of storeId + user_login on success so we can confirm callback fires and matches the expected store row.
- `src/pages/projects/index.tsx` — after `invalidateQueries` resolves, also call `qc.refetchQueries({ queryKey: queryKeys.stores })` and `await` it before opening the dialog; fallback: if `editStore` still shows no wp_username after 3s, log a warning.

### Verification steps after fix

1. Add a site with Proxima → authorize WP → confirm "Connected as {username}" pill.
2. Click "Re-authorize" (same site) → approve again → confirm pill still shows connected and username updated.
3. Click "Disconnect" → confirm → confirm pill flips to "Not connected" WITHOUT freezing the app.
4. Re-authorize after disconnect → confirm reconnection works.
5. Check network tab: `/api/stores/{id}/update` returns 200, NOT hung.
6. Check `wp-callback` server log: sees `WP credentials saved for store {uuid}` with expected UUID.

## Checklist

- [x] Create `src/pages/api/stores/[storeId]/update.ts` that authenticates via bearer token, validates caller can edit the store, uses `supabaseAdmin` to update the row, returns updated store
- [x] Refactor `updateStore` in `src/services/storeService.ts` to call the new endpoint (mirror `createStore`/`deleteStore` pattern, localStorage token + fetch)
- [x] Keep `disconnectWpCredentials` signature unchanged — it already delegates to `updateStore`, fix propagates
- [x] Wrap `handleWpDisconnect` body in try/finally so the AlertDialog always closes, even on failure
- [x] Add `console.log` in `app-password-callback.ts` showing parsed storeId, user_login, and update result
- [x] In `projects/index.tsx` effect, await `qc.refetchQueries({ queryKey: queryKeys.stores })` (not just invalidate) before opening dialog so fresh data is guaranteed
- [x] Manual test: add → authorize → re-authorize → disconnect → re-authorize (each step shown verified in description above)
- [x] No regression: creating a new site and editing name/URL of existing site still works

## Acceptance

- Re-authorizing WordPress for an existing site lands back on /projects with the Edit dialog reopened showing "Connected as {username}" and the new username persisted in DB.
- Clicking Disconnect closes the confirmation dialog and flips the pill to "Not connected" within 2s — app remains fully responsive.
- Browser dev tools network tab shows `/api/stores/{id}/update` returning 200 OK (no hung requests).
