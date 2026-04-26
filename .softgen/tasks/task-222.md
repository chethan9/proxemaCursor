---
title: Plan-driven initial-sync window for orders + customers
status: done
priority: high
type: feature
tags: [sync, billing, performance]
created_by: agent
created_at: 2026-04-26
position: 222
---

## Notes

**Goal:** cap how far back we fetch from WooCommerce on initial sync + backfill, gated by the customer's billing plan. **No destructive trimming or deletion** — we never delete data customers already have. This is fetch-window gating, not retention enforcement.

**Why:** prevents huge initial syncs from melting the system, gives plans a real differentiator ("Pro syncs 12 months of history"), and keeps the upgrade path frictionless (upgrade → next sync pulls more, no data loss either way).

**Already shipped on the live DB:**
- `stores.orders_history_from timestamptz NOT NULL DEFAULT NOW() - INTERVAL '3 months'`. Existing rows backfilled.

**Remaining work:**

### 1. Plan schema
- Add `plans.max_initial_history_days int` (NULL = unlimited).
- Suggested defaults when an admin first edits each plan: Free 90, Pro 365, Enterprise NULL. Don't auto-fill — let the admin set.
- `plans` already has `max_products_per_site` (advisory; not enforced by deletion). Leave it. Do NOT add `max_orders_per_site` or `max_customers_per_site` — explicitly out of scope.

### 2. Resolver helper
- `getEffectiveHistoryFrom(storeId)` returns the ISO date passed to Woo `?after=`:
  - Read site's `orders_history_from`.
  - Read the client's active subscription → plan → `max_initial_history_days`.
  - If plan has a cap, compute `planFloor = NOW() - max_initial_history_days days` and return `max(planFloor, site.orders_history_from)` (the more restrictive wins).
  - If no active sub or unlimited plan: just return `site.orders_history_from`.

### 3. Sync engine wiring
- `src/pages/api/stores/[storeId]/sync.ts`:
  - Read effective history-from inside `fetchStoreForSync`.
  - In `runAspectChunk`, when aspect is `orders` or `customers` AND there is no `modified_after` (i.e. initial or full sync, not incremental), pass `after=<effective>` to WooCommerce.
  - Incremental syncs (`modified_after` set) are untouched — they already only fetch updates.

### 4. Site settings UI (`src/pages/sites/[id]/settings.tsx`)
- New "Historical data window" card showing:
  - Effective fetch-from date (after plan clamp).
  - Site's chosen date (date input, default = today − 3 months).
  - Plan ceiling banner: "Your plan allows up to X months of history. Upgrade to fetch more."
  - "Save window" button (writes `orders_history_from`, clamped client-side to plan ceiling).
  - "Run backfill" button — POSTs to the existing sync endpoint with `aspect: orders` then `aspect: customers`. Toast + redirect to sync-runs page so they can watch progress.
- Show current row counts inline ("You have 4,231 orders synced") for context — read-only, no enforcement.

### 5. Admin plan editor
- `src/pages/settings/plans.tsx` (or wherever plans are edited): add a "Max initial history (days)" number input next to existing limits. Empty = unlimited.

### 6. Activity log
- Log `store.history_window_changed` (actor, store, before/after dates) on save.
- Log `plan.history_limit_changed` (actor, plan, before/after days) on plan edit.

### What this task does NOT do
- No row-count enforcement, no deletion of synced data, no cron trim job. If the user wants to free up space or change plan tier, we keep what's already synced. Future tasks can add explicit "Archive old data" as a user-initiated action, never automatic.

## Checklist

- [x] DB migration: `ALTER TABLE plans ADD COLUMN max_initial_history_days int` (nullable).
- [x] `getEffectiveHistoryFrom(storeId)` server helper that computes `max(planFloor, site.orders_history_from)`.
- [x] Sync API reads effective date and passes `?after=<iso>` to Woo for orders + customers on non-incremental runs.
- [x] Site settings page: "Historical data window" card with effective date display, date input, plan ceiling banner, Save + Backfill buttons.
- [x] Backfill button triggers orders + customers sync via existing sync endpoint and toasts + links to sync-runs.
- [x] Plan editor exposes "Max initial history (days)" field with NULL = unlimited.
- [x] Activity log entries for `store.history_window_changed` and `plan.history_limit_changed`.
- [x] Site-settings client-side clamp prevents picking a date older than plan allows; shows upgrade CTA if user tries.
- [x] Loading + empty states wired (no plan = treat as unlimited; no subscription = treat as unlimited for now).

## Acceptance

- Admin can set "Max initial history (days)" on a plan; empty = unlimited.
- A new site on a 90-day plan, on first sync, fetches at most 90 days of orders + customers from Woo.
- A site owner can push their `orders_history_from` back to any date within the plan ceiling and click "Run backfill" to fetch the gap. Existing rows are preserved.
- Changing the plan ceiling or the site's window is recorded in `activity_log` with before/after values.
- No existing synced data is ever deleted by this feature.