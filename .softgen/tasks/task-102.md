---
title: Remove notification system + sidebar progress ring + completion popup
status: todo
priority: urgent
type: chore
tags: [cleanup, notifications, sync-ui]
created_by: agent
created_at: 2026-04-21T02:40:00Z
position: 102
---

## Notes

User decision: rip out the entire notification subsystem and the sidebar percentage ring. Keep only the top-bar `SyncProgressBanner` as the single sync-status surface. No completion popups or toasts — when sync ends, the banner just disappears.

### Why
1. **Notification system is over-engineered and buggy**: `NotificationProvider` polls DB every 30s, reopens dialogs, and keeps re-firing celebration popups because `dismissed_at` updates sometimes fail silently. User hit re-trigger at 100%.
2. **Sidebar percentage ring** (`ProgressRing` in `AppSidebar.tsx`) duplicates info already shown in the top banner and looks awkward next to the site name.
3. **Bell / announcement sheet** is unused clutter.

### Popup re-triggering root cause
Two separate systems can fire a "sync complete" popup:
- `SyncProgressBanner.tsx` lines 70-113: `seenCompletionsRef` is component-scoped, so a route change remounts the banner and the Set empties → toast fires again.
- `NotificationProvider` polls `user_notifications` every 30s. Any row with `dismissed_at IS NULL` re-queues. If the `UPDATE ... SET dismissed_at` call is blocked by RLS or the row was inserted server-side as a celebration, it loops forever.

Fix = remove both. No completion popup at all.

### Files to delete
- `src/contexts/NotificationProvider.tsx`
- `src/components/notifications/NotificationRenderer.tsx`
- `src/components/notifications/` (whole folder)
- `src/components/layout/NotificationBell.tsx`
- `src/components/notifications-admin/ComposeForm.tsx`
- `src/components/notifications-admin/HistoryTable.tsx`
- `src/components/notifications-admin/ActivityLog.tsx`
- `src/components/notifications-admin/NotificationPreview.tsx`
- `src/components/notifications-admin/` (whole folder)
- `src/pages/admin/notifications.tsx`
- `src/pages/api/notifications/create.ts`
- `src/pages/api/notifications/send.ts`
- `src/pages/api/notifications/` (whole folder)
- `src/services/notificationAdminService.ts`
- `src/hooks/useUnreadNotifications.ts`
- `public/confetti.json`

### Files to edit
- `src/pages/_app.tsx` — remove `NotificationProvider` import + wrapper, remove `NotificationRenderer` render
- `src/components/layout/AppSidebar.tsx`:
  - Remove `NotificationBell` import + its usage (currently in the footer/top area)
  - Remove `ProgressRing` function definition (line ~33) and its usage (line ~422)
  - Remove the `activeSyncs` Map lookup that feeds `syncPct` for the ring (keep the shimmer-line underneath site row if it's present — actually, remove that too, per user "remove the entire thing")
  - Keep `useAllActiveSyncs` only if still used elsewhere in the sidebar; if not, remove the import
- `src/components/SyncProgressBanner.tsx`:
  - Delete the entire "Background completion toasts" effect block (lines ~70-113, the `prevSnapshotRef` / `pendingRemovalRef` / `skipNextBgCheckRef` block and the toast call inside it)
  - Delete the current-site completion detection effect (lines ~56-68) that invalidates queries on completion — sync-end invalidation can live in `useActiveSync` if needed; the banner itself just unmounts
  - Remove the `useToast` import + `toast` call
  - Remove `supabase` import if unused after cleanup
  - Keep: progress bar, rocket, elapsed, percentage pill, dismiss button, and the compact row for other-site syncs
- `src/pages/admin/notifications.tsx` — deleted; if linked from sidebar menu config, remove link target too
- `src/lib/menu-registry.ts` / `src/lib/menu-merge.ts` — scan for any `/admin/notifications` entries; remove if present
- Any sidebar menu config default that references notifications — prune

### Files to verify (no edits expected but confirm clean)
- `src/services/*` — confirm nothing else imports `notificationAdminService`
- `src/hooks/queries/*` — confirm nothing imports the deleted hook

### Database cleanup (optional, user can decide later)
`user_notifications` table can stay; nothing will write/read it after this change. Leaving in place for now is fine. If user wants it dropped, add a migration later.

### Popup at 100% — final behavior after cleanup
- Sync reaches 100% → `useActiveSync` returns `running: false` → `SyncProgressBanner` conditional renders nothing.
- No toast, no dialog, no celebration overlay. Users see the top bar simply vanish.
- Data query invalidation (products/orders refetch) moves into `useActiveSync` itself: when it detects transition from `running: true` → `running: false`, it calls `queryClient.invalidateQueries` for the relevant keys, so tables still refresh at completion.

### Sidebar percentage ring removal
Before: site row shows `[icon] todoo [99% ring]`
After: site row shows `[icon] todoo` — that's it. Progress info lives only in the top banner.

## Checklist

- [ ] Delete `src/contexts/NotificationProvider.tsx`, `src/components/notifications/` folder, `src/components/layout/NotificationBell.tsx`, `src/components/notifications-admin/` folder, `src/hooks/useUnreadNotifications.ts`, `src/services/notificationAdminService.ts`
- [ ] Delete `src/pages/admin/notifications.tsx`, `src/pages/api/notifications/` folder, `public/confetti.json`
- [ ] Unwrap `NotificationProvider` and remove `<NotificationRenderer />` from `src/pages/_app.tsx`
- [ ] Remove `NotificationBell` import and usage from `src/components/layout/AppSidebar.tsx`
- [ ] Remove `ProgressRing` function and its usage from `src/components/layout/AppSidebar.tsx`, plus the `activeSyncs` Map lookup feeding `syncPct`
- [ ] Remove any shimmer-line-under-active-site element in `AppSidebar.tsx` (per task-97) so the sidebar row is a plain icon + name again
- [ ] In `src/components/SyncProgressBanner.tsx`, delete the background-completion toast effect, the current-site completion detection effect, and unused imports (`useToast`, `supabase`, `useRef`-based snapshot refs)
- [ ] Move sync-end query invalidation into `src/hooks/queries/useActiveSync.ts` — when the hook detects `running: true → false` (via a `useRef`), call `queryClient.invalidateQueries` for `["orders"]`, `["products"]`, `["taxonomy"]`
- [ ] Scan and remove any `/admin/notifications` sidebar menu entries in `src/lib/menu-registry.ts` or menu-config defaults
- [ ] Run `<check_for_errors />` — fix any remaining imports of deleted files
- [ ] Manual verify: no bell in sidebar; no percentage ring; sync completion silently unmounts banner; tables auto-refresh on completion

## Acceptance

- Sidebar site rows show only icon + name, no percentage ring, no bell, no shimmer line.
- When a sync finishes, the top progress banner disappears silently — no toast, no dialog, no re-trigger on page navigation.
- Products/orders pages still auto-refresh with new data when sync completes (query invalidation moved into `useActiveSync`).
- Admin notifications page is gone; no 404s from sidebar menu links.
- `check_for_errors` reports clean.