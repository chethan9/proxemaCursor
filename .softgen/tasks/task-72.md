---
title: Fix WP disconnect — nested dialogs freeze app, disconnect never fires
status: done
priority: urgent
type: bug
tags: [wordpress, disconnect, dialog, radix]
created_by: agent
created_at: 2026-04-19
position: 72
---

## Notes

User reports three linked symptoms on "Disconnect WordPress" flow in `EditSiteDialog`:

1. **Confirmation message shows empty site name** — "This will revoke Proxima's media library access for ." — the `{store?.name}` interpolation is blank.
2. **Edit dialog disappears behind the AlertDialog** — the parent `<Dialog>` closes when the nested `<AlertDialog>` opens.
3. **Clicking Cancel freezes the entire app** — page becomes non-clickable. On refresh, the site is still connected (disconnect never actually ran).

### Root cause (high confidence)

This is a classic **Radix nested overlay bug**. `EditSiteDialog.tsx` renders an `<AlertDialog>` *inside* a `<Dialog>` (both Radix primitives). When the `<AlertDialog>` opens:

- Radix `<Dialog>` modal behavior grabs focus/body-scroll-lock/pointer-events.
- The nested `<AlertDialog>` does the same, but when it closes (Cancel or Action), it may release `pointer-events: none` on `<body>` incorrectly OR the parent Dialog loses its state.
- Result: body pointer-events stays disabled → entire app becomes unclickable.
- The parent Dialog's `store` prop becomes `null` (closed in background) → confirmation text shows empty name.

Because the parent Dialog is unmounted while AlertDialog is open, clicking Cancel returns to a frozen shell — and the disconnect action (if clicked) runs against `store = null`, so the early return `if (!store) return;` fires and nothing happens.

### Fix strategy

**Option A (recommended): flatten — don't nest AlertDialog inside Dialog.**
Replace the AlertDialog with an inline confirmation state *inside* the Dialog: when user clicks Disconnect, swap the WordPress card content to show "Are you sure? [Cancel] [Disconnect]" buttons instead of opening a second modal. No nested overlays, no Radix conflict.

**Option B (fallback): move AlertDialog outside the Dialog tree** by using a portal state lifted to the parent page. More invasive, keeps two-modal UX.

Go with Option A. It's simpler, avoids the Radix bug entirely, and the inline confirmation is arguably better UX for a destructive toggle inside a larger form.

### Files to change

- `src/components/project/EditSiteDialog.tsx`:
  - Remove the `<AlertDialog>` block entirely
  - Add a `wpConfirmMode` boolean state ("idle" | "confirming")
  - When user clicks "Disconnect", set `wpConfirmMode="confirming"` — swaps the WP card footer to show a warning + [Cancel] [Yes, Disconnect] buttons
  - Yes → call `disconnectWpCredentials`, on success close dialog; on error toast + reset to idle
  - Cancel → reset to idle
  - Remove `confirmDisconnect` / `disconnecting` states that relate to AlertDialog
  - Keep the `try/finally` pattern from task-71 so dialog closes cleanly

### Verification steps

1. Open Edit Site for a WP-connected project.
2. Click Disconnect → WP card shows inline warning with [Cancel] / [Yes, Disconnect].
3. Click Cancel → card returns to normal, app stays responsive, no freezing.
4. Click Disconnect again → confirm → pill flips to "Not connected", dialog closes, app responsive.
5. Refresh → DB shows `wp_username` / `wp_app_password` are null.
6. Re-authorize works afterward (ties into task-71 fix).

## Checklist

- [x] Remove `<AlertDialog>` block + `confirmDisconnect` state from `EditSiteDialog.tsx`
- [x] Add `wpConfirmMode` state ("idle" | "confirming") inside the component
- [x] Clicking "Disconnect" button sets `wpConfirmMode="confirming"` instead of opening AlertDialog
- [x] Render inline confirmation inside the WordPress card: destructive-tinted warning text + [Cancel] + [Yes, Disconnect] buttons
- [x] Cancel resets `wpConfirmMode="idle"`, leaves dialog open
- [x] Confirm calls `disconnectWpCredentials(store.id)` inside try/finally, toasts on success/error
- [x] On success: close Edit dialog and call `onSaved?.()` so stores query refreshes
- [x] Remove unused imports (`AlertDialog`, `AlertDialogAction`, etc.) from the file
- [x] Manual test: Cancel does not freeze app; Disconnect actually clears `wp_username` in DB; refresh shows "Not connected"

## Acceptance

- Clicking Disconnect does NOT open a second modal — confirmation appears inline within the existing Edit Site dialog.
- Cancel returns to the normal WP card view with the app fully responsive (no pointer-events lockout).
- Confirming disconnects the credentials, closes the Edit dialog, updates the pill to "Not connected" after refetch.