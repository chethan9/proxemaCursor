---
title: Unified notification center (celebrations, announcements, ads)
status: todo
priority: high
type: feature
tags: [architecture, notifications, infrastructure]
created_by: agent
created_at: 2026-04-20
position: 1
---

## Notes

**Why now:** User plans to add more popups, animations, Lottie celebrations, ads, feature announcements, milestone unlocks. Current system has three disconnected patterns: `toast` (shadcn), bespoke `SyncCelebrationDialog` with custom watcher, `BulkJobsToast` persistent bar. Adding every new popup as its own bespoke component is not scalable — they'll conflict, duplicate dedup logic, and have inconsistent presentation.

**Goal:** Single notification queue backed by Supabase. One provider, one renderer, many types. Future popup = new type + renderer case, not a new end-to-end system.

**Data model — new `user_notifications` table:**
- `id` uuid pk
- `user_id` uuid — target user (null = broadcast to all)
- `client_id` uuid nullable — scope to one client (for multi-tenant targeting)
- `type` text — enum: `celebration`, `announcement`, `ad`, `milestone`, `info`, `warning`
- `title` text
- `body` text nullable — markdown allowed
- `cta_label` text nullable
- `cta_url` text nullable
- `image_url` text nullable
- `lottie_url` text nullable — path to confetti.json or similar animation asset
- `priority` int default 50 — 0-100, higher = shown first
- `shown_at` timestamptz nullable — set when user first sees it (dedup)
- `dismissed_at` timestamptz nullable — set when user closes
- `clicked_at` timestamptz nullable — set when CTA clicked
- `created_at` timestamptz default now()
- `expires_at` timestamptz nullable — auto-hide after this time
- `metadata` jsonb — arbitrary context (store_id for celebrations, campaign_id for ads)

**RLS:** Use T1 pattern — users see only their own rows OR broadcasts (user_id is null).

**Architecture:**

1. **`NotificationProvider`** global in `_app.tsx` (replaces `SyncCelebrationWatcher` location):
   - Subscribes to `user_notifications` realtime for current user
   - Polls every 30s as fallback
   - Re-queries on `visibilitychange` (covers week-long offline case)
   - Maintains in-memory queue sorted by priority desc, then created_at asc
   - Stamps `shown_at` optimistically when pulling from queue (exactly-once across tabs/sessions)
   - Exposes `useNotifications()` hook: `{ current, dismiss(), click() }`

2. **`NotificationRenderer`** mounted globally, picks presentation by `type`:
   - `celebration` → overlay + card + confetti lottie (port from `SyncCelebrationDialog`)
   - `announcement` → centered modal with image/lottie + title + body + CTA button
   - `ad` → dismissible banner top of page OR slide-in panel bottom-right
   - `milestone` → toast + optional burst animation
   - `info` / `warning` → shadcn toast fallback

3. **Server-side creation API**:
   - `POST /api/notifications/create` — admin/system endpoint for broadcasts and server-triggered events
   - Sync completion handler in `api/stores/[storeId]/sync.ts` creates a `celebration` notification instead of stamping `stores.initial_sync_completed_at`
   - Future: admin dashboard page to compose + broadcast announcements/ads

**Migration of existing celebration flow:**
- Sync done → server inserts `user_notifications` row: `type=celebration`, `metadata={store_id, store_name, store_url, logo_url}`, `lottie_url=/confetti.json`, `title="X is now on Proxima"`
- Watcher picks it up via realtime OR on next poll/focus (works for week-old unstamped notifications)
- Stamps `shown_at` optimistically → dedup across tabs/sessions guaranteed
- User clicks done → `dismissed_at` set
- Replace `stores.celebration_shown_at` usage with notification row existence check
- Keep `stores.initial_sync_completed_at` as data fact (when sync finished), just don't use it for dedup anymore

**`useNotifications` pushable (transient):**
- For in-session ephemeral notifications that don't need DB persistence (form success, validation)
- Goes through same queue and renderer, just not persisted
- Most cases should still use shadcn `toast` for truly ephemeral — provider is for the presentational popup types

## Checklist

- [ ] Create `user_notifications` table with columns above, RLS T1 (own rows) + public-read policy when user_id is null for broadcasts, indexes on (user_id, shown_at), (created_at desc)
- [ ] Create `NotificationProvider` context in `src/contexts/NotificationProvider.tsx`: realtime subscription + 30s polling + visibilitychange handler + priority queue + optimistic shown_at stamping
- [ ] Create `NotificationRenderer` component in `src/components/notifications/` that switches on `type`:
  - Celebration: full-screen overlay, confetti lottie, centered card with store logo + CTA
  - Announcement: centered modal with image/lottie, title, body, CTA button, dismiss X
  - Ad: top banner OR slide-in panel variant, dismissible, with image and CTA
  - Milestone: toast + lottie burst
  - Info/warning: standard toast via existing hook
- [ ] Mount `<NotificationProvider>` and `<NotificationRenderer />` in `_app.tsx` inside `<Providers>` (replaces `SyncCelebrationWatcher` location)
- [ ] Migrate sync-complete flow: `src/pages/api/stores/[storeId]/sync.ts` inserts `celebration` notification row on `is_initial=true` completion instead of (or alongside) stamping `stores.initial_sync_completed_at`
- [ ] Delete `src/components/SyncCelebrationWatcher.tsx` and `src/components/SyncCelebrationDialog.tsx` (folded into renderer)
- [ ] Create `POST /api/notifications/create` endpoint for admin broadcasts (super-admin only), accepts title/body/type/cta/image/lottie/priority, target user_id or null for broadcast
- [ ] `useNotifications()` hook exported for app code — `.push({...})` for transient, or call the create API for persistent
- [ ] Verify: complete an initial sync → celebration fires on whatever page user is viewing (not just projects), persists across a logout/login cycle if dismissed_at is null, auto-cleans after dismiss

## Acceptance

- A user who completes initial sync while on the Settings page sees celebration confetti + card on Settings (not just projects)
- A user offline for a week logs back in and sees any pending celebrations/announcements queued during that time
- Admin can insert a row into `user_notifications` (via API or SQL) and it appears on the target user's screen within 30 seconds (realtime) or on next page focus
- Only one notification shows at a time — higher-priority types (warnings) show before ads even if ads were queued first
- Dismissed notifications never re-appear, even across devices