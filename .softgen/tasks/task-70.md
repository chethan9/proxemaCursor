---
title: Mirror WP media to Postgres for scalable image picker
status: todo
priority: medium
type: feature
tags: [products, media, sync, scalability]
created_by: agent
created_at: 2026-04-19
position: 70
---

## Notes
Phase 2 of media scalability. Instead of hitting WP REST on every picker open, keep a mirror of `wp_media` in Postgres per store, refreshed via sync engine + webhooks. Picker queries Postgres — consistent sub-100ms regardless of store size.

**Why:** WP REST `/wp/v2/media` is slow on stores with 1000+ images (PHP + meta joins, no CDN). Users notice on every product edit. Mirror makes it disappear.

**Sync sources:**
- Initial sync: paginated full pull into `wp_media` on site connect
- Webhooks: subscribe to `media.created`, `media.updated`, `media.deleted` (WordPress core supports these via WC webhook or a tiny MU plugin)
- Cron: hourly delta refresh using `?modified_after=<last_sync>` as safety net
- Manual refresh button in picker for edge cases

**Schema:**
- `wp_media` table: `id bigint (WP id)`, `store_id uuid`, `source_url`, `thumbnail_url`, `alt`, `title`, `mime_type`, `wp_date timestamptz`, `synced_at timestamptz`
- Unique `(store_id, id)`, index on `(store_id, wp_date desc)`, text search index on `title + alt`
- RLS: T2 (authenticated read for anyone with store access, insert/update via service role only)

**Scope:**
- Migration: `wp_media` table + indexes + RLS
- `src/services/wpMediaMirrorService.ts` — sync + query from Postgres
- New sync aspect `media` in sync engine (mirrors existing products/orders pattern)
- Webhook handler extension for media events
- `ImagePickerDialog` reads from Postgres via new service; WP REST only as fallback
- Upload flow: POST to WP → insert row into `wp_media` on success

## Checklist
- [ ] Migration creates `wp_media` with proper indexes + RLS
- [ ] Initial sync pulls all existing WP media into Postgres on demand
- [ ] Webhook handler catches media create/update/delete and mirrors changes
- [ ] Cron sync-scheduler includes media aspect with configurable interval
- [ ] Image picker reads from Postgres first, falls back to WP REST with toast warning
- [ ] Upload inserts mirror row after successful WP POST
- [ ] Search uses Postgres full-text on title + alt — instant
- [ ] Manual "refresh from WP" button triggers one-off sync run
- [ ] Sync runs page shows media sync runs with processed count

## Acceptance
- Picker opens in < 200ms for a store with 5000+ media items.
- Newly uploaded images appear without waiting for sync.
- WP-side edits (rename, alt change) appear in picker within one sync cycle.