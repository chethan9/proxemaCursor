---
title: Super Admin notifications console
status: todo
priority: high
type: feature
tags: [admin, notifications, ui]
created_by: agent
created_at: 2026-04-20T02:40:00Z
position: 88
---

## Notes

Build a super-admin-only console to compose, send, schedule, and monitor notifications backed by the existing `user_notifications` table (see `src/contexts/NotificationProvider.tsx` + `src/pages/api/notifications/create.ts`).

**Access control:** Gate entire section behind `is_super_admin()`. Add `NOTIFICATIONS_MANAGE` permission to `src/lib/permissions.ts` and wrap routes with `AuthGuard`. Non-super-admins get 403.

**Surface in sidebar:** Add a "Notifications" item in `AppSidebar.tsx` under the admin/settings section, visible only to super admins.

**Data model (already exists):** `user_notifications` has id, user_id (nullable = broadcast), client_id, type (celebration|announcement|ad|milestone|info|warning), title, body, cta_label, cta_url, image_url, lottie_url, priority, shown_at, dismissed_at, clicked_at, created_at, expires_at, metadata.

**No schema changes needed.** Reuse existing RLS. Super-admin writes go through a server endpoint (already `POST /api/notifications/create`, extend to support targeting + scheduling).

**Three sub-pages under `/admin/notifications`:**

1. **Compose / Send** — form to create a new notification
2. **Sent / History** — table of all past notifications with engagement stats
3. **Live activity log** — real-time stream of shown/clicked/dismissed events

**Engagement stats computed on the fly:** recipients (user rows matching user_id filter, or all active users for broadcasts), shown count (rows where shown_at IS NOT NULL), click-through rate (clicked_at/shown_at), dismiss rate.

**Extend `/api/notifications/create`** to accept: `targeting: "broadcast" | "user" | "client" | "role"` + `target_ids[]`, and fan out one row per target user for non-broadcast sends. For client/role targeting, resolve user list server-side from profiles.

Reference existing patterns: `src/pages/api-management.tsx` for console layout, `src/components/api/ApiKeysTable.tsx` for table+stats style, `src/components/project/AddSiteDialog.tsx` for composer dialog.

## Checklist

- [ ] Add `NOTIFICATIONS_MANAGE` permission constant and gate super-admin-only routes
- [ ] Add "Notifications" sidebar entry visible to super admins only (icon: Bell)
- [ ] Compose page: form with type selector (6 types with visual previews of each variant), title, body (textarea), CTA label + URL, image URL, Lottie URL, priority slider (0-100), expires_at date picker
- [ ] Targeting picker in composer: Broadcast (all users), Specific users (searchable multi-select of profiles), By client (dropdown of clients), By role (dropdown of roles)
- [ ] Live preview panel in composer: renders the notification the same way `NotificationRenderer` will, updates as user types
- [ ] Send / Schedule buttons: Send Now (immediate insert), Schedule (sets created_at in future — noted as deferred if cron isn't wired, use expires_at + future scheduled_at column OR simply insert with far-future created_at via server time)
- [ ] Server endpoint extension: POST /api/notifications/create accepts targeting + fan-out logic, returns count of rows inserted
- [ ] History page: table of all notifications sorted by created_at desc — columns: type badge, title, target summary (user/broadcast/client name), recipients count, shown count, CTR%, dismiss%, created_at, actions (view details, duplicate, revoke)
- [ ] Filter bar on history: type multi-select, date range, target type, search by title
- [ ] Details drawer: full notification payload, per-recipient delivery status (shown/dismissed/clicked timestamps), raw metadata JSON
- [ ] Revoke action: sets expires_at = now() on all matching rows so unshown ones stop appearing
- [ ] Duplicate action: pre-fills composer with the selected notification's fields
- [ ] Activity log page: live-updating feed (realtime subscription on user_notifications updates) showing "user X viewed/clicked/dismissed notification Y" events with timestamp + user avatar
- [ ] Stats dashboard header on history page: total sent (7d), avg CTR, avg dismiss rate, top-performing notification by CTR
- [ ] Empty states for each page (no notifications sent, no activity yet)
- [ ] CSV export of history table

## Acceptance

- Super admin can compose a notification, preview it live, target broadcast/user/client/role, and send — recipients see it within seconds via realtime
- Super admin can see every notification ever sent with real engagement numbers and drill into per-user delivery
- Revoking a scheduled/active notification immediately stops further impressions
- Non-super-admins cannot access any part of the console (routes + sidebar hidden, API returns 403)