---
title: Webhook dedup fix + banner polish (narrower bar, slower messages, forward rocket)
status: done
priority: high
type: bug
tags: [bug, webhooks, sync, ui]
created_by: agent
created_at: 2026-04-19
position: 0
---

## Notes

Three related polish items. Bundled because they all touch the sync UI + onboarding flow.

### 1. Webhook duplication bug (HIGH — real bug, ~21 webhooks created on site)

**Root cause:** `register-webhooks` endpoint is called from TWO places during onboarding:
- `src/pages/api/woocommerce/callback.ts:46` — fires immediately after OAuth callback persists credentials
- `src/pages/sites/connect/[id].tsx:109` — fires again inside `runEstimateAndLiftoff()` after WP auth

Each call hits `POST /wp-json/wc/v3/webhooks` for all 7 topics (products.create/update/delete, orders.create/update/delete, customer.create). WooCommerce happily creates duplicates — no topic+url uniqueness enforcement on their side. Result: 2 registrations × 7 topics = 14 webhooks, plus any pre-existing ones from earlier attempts = ~21 observed.

**Fix — make `register-webhooks.ts` idempotent:**
- Before creating any webhook, query local `webhooks` table for rows matching `(store_id, topic)`. If a row exists with a `woo_webhook_id`, call `PUT /wp-json/wc/v3/webhooks/{id}` to UPDATE the delivery URL/status instead of creating new.
- If no local row, still check WooCommerce: `GET /wp-json/wc/v3/webhooks?topic={topic}` and filter by `delivery_url === our_url`. If found → adopt (upsert local row, don't create). If not → create.
- Upsert local `webhooks` table row on success (match by `store_id + topic`, unique constraint should already exist — verify).

**Also:** Remove the duplicate call from `connect/[id].tsx` line 109 since `callback.ts` already registers on cred receipt. Leave in place for the manual WP-skip path only (user skipped WP auth → no callback fires). Actually — `callback.ts` fires on WooCommerce OAuth callback, not WP auth. So register-webhooks from callback.ts is enough; the second call is pure duplicate. Remove it from `runEstimateAndLiftoff`.

**Cleanup existing duplicates:** Add a one-shot endpoint `POST /api/webhooks/repair-all` that: fetches all webhooks from WooCommerce for each connected store, groups by topic, keeps newest per topic, deletes the rest (WooCommerce DELETE /webhooks/{id}?force=true). Also clean up orphan local rows. Admin can call this from the webhook management page.

### 2. Banner visual polish

**Current:** Progress bar fills the full flex-1 width between left label and right meta. Message region is `w-48 truncate`, too narrow for longer lines like "Still faster than doing it manually 😄".

**Fix:**
- Progress bar container: wrap in a `max-w-sm` (or `max-w-md`) constraint so the bar doesn't stretch edge-to-edge. Bar region becomes the middle column of a `[left] [bar max-w-sm] [right flex-1]` layout.
- Message region: bump to `w-64 truncate` (~256px) on the right so longer messages show fully.
- Message rotation interval: bump `setInterval` from 4000ms → **5000ms** in `SyncProgressBanner` so users can actually read each line.
- Connect page `progressTick` interval: bump from 2500ms → **4000ms** for the "Scanning store inventory" caption.

### 3. Rocket fixes

**Reference:** User provided image — rocket pointing right (forward) with particle trail behind, riding the progress bar.

**Current problems:**
- Rocket icon points up (lucide default orientation) — looks like it's launching into space, not racing toward finish.
- Rocket position driven by time (`elapsed / 300s`) drifts from the actual progress %. Looks disconnected.
- Wiggle animation makes it look unstable.

**Fix:**
- Rotate rocket icon so it points right-forward. `rotate-[35deg]` or `rotate-45` gives the forward-lean angled look from the reference.
- Position rocket at `left: {progress}%` — SAME as the bar fill. They should move together.
- Remove the `rocketWiggle` keyframes. Keep the smooth `transition-[left]` so it slides.
- Optionally: add a small trail of 3 dots behind it, each slightly smaller + more transparent (`::before` pseudo or 3 spans). Keep subtle — don't overdo.
- Drop shadow stays for contrast against the green bar.

**Files touched:**
- `src/pages/api/stores/[storeId]/register-webhooks.ts` — add idempotency (DB + WC existence checks)
- `src/pages/sites/connect/[id].tsx` — remove duplicate register-webhooks call, slow progressTick interval
- `src/components/SyncProgressBanner.tsx` — narrower bar, wider message slot, slower rotation, rocket rotation + progress-synced position
- `src/pages/api/webhooks/repair-all.ts` — NEW one-shot cleanup endpoint for existing dupes
- `src/pages/webhooks/index.tsx` — add "Repair duplicates" button that calls the repair endpoint (visible to admins)

## Checklist

- [ ] Make `register-webhooks.ts` idempotent: check local DB + WooCommerce for existing webhook per topic before creating; UPDATE existing or adopt existing WC webhook matching our delivery URL
- [ ] Remove the duplicate `register-webhooks` fetch call from `runEstimateAndLiftoff` in `connect/[id].tsx` (callback.ts already handles it)
- [ ] Add `POST /api/webhooks/repair-all` endpoint that deduplicates existing webhooks per (store, topic) — keeps newest, deletes rest via WooCommerce API + cleans local table
- [ ] Add "Repair duplicate webhooks" action button on the webhooks page that calls the repair endpoint and shows a toast with cleanup count
- [ ] Banner layout: constrain progress bar to `max-w-sm`, widen message region to `w-64`, bump message rotation to 5000ms interval
- [ ] Connect page "Scanning store inventory" caption: bump tick interval from 2500ms to 4000ms
- [ ] Rocket: rotate icon ~35-45° so it points forward (right-diagonal), sync position with actual progress % (not time-based), remove wiggle keyframes
- [ ] Optional: add 3-dot particle trail behind rocket for the racing-rocket look from the reference image

## Acceptance

- Connecting a new site creates exactly 7 webhooks (one per topic), not 14+
- Repair endpoint cleans up existing duplicate webhooks, leaving only the newest per topic per store
- Banner's fun messages display in full without truncation and rotate slow enough to read (~5s)
- Rocket icon points forward (right-angled) and its position always matches the green bar fill %