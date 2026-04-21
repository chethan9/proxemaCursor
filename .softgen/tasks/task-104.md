---
title: Sync retry with exponential backoff + failure diagnostics
status: done
priority: high
type: feature
tags: [sync, resilience, debugging]
created_by: agent
created_at: 2026-04-21T03:05:00Z
position: 104
---

## Notes

Two problems, one task:
1. A single failed sync (network blip, WooCommerce 502, timeout) permanently marks the run as `failed` and nothing retries until next cron (could be hours).
2. When a sync does fail, the error message is just `WooCommerce API error: 403 Forbidden` — no way to know which endpoint, what headers, or reproduce it. User wants a copy-paste curl command for quick troubleshooting.

### Design — Retry with backoff
- Add columns to `sync_runs`:
  - `attempt INT NOT NULL DEFAULT 1`
  - `next_retry_at TIMESTAMPTZ NULL`
  - `request_url TEXT NULL` — exact URL Woo was called with (minus secrets)
  - `request_method TEXT NULL` — GET/POST/PUT/DELETE
  - `request_params JSONB NULL` — query params as JSON
  - `response_status INT NULL` — HTTP status code
  - `response_body TEXT NULL` — first 2000 chars of Woo's response body
  - `response_headers JSONB NULL` — key response headers (x-wp-total, x-ratelimit-*, etc.)
- Add `retrying` to `sync_runs_status_check` allowed values (migration).
- Backoff schedule: attempt 1→2 wait 30s, 2→3 wait 2m, 3→4 wait 5m, 4→5 wait 15m. After attempt 5 fails, status becomes permanent `failed`.
- Non-retryable errors (401, 403, 404, 400) skip retry entirely — mark `failed` immediately with full diagnostics.
- New cron `src/pages/api/cron/sync-retry.ts` every minute picks `status='retrying' AND next_retry_at<=now()` limit 20, re-runs the aspect sync with incremented attempt.

### Design — Failure diagnostics UI
- Update `src/lib/woo-client.ts` to capture full request/response context on error and rethrow a typed error.
- Update `src/pages/api/stores/[storeId]/sync.ts` and `sync-scheduler.ts` to persist all diagnostic columns on failure (retry or permanent).
- In `src/pages/sync-runs/index.tsx` detail dialog, add an **"API Request"** section when the run failed:
  - Method + URL (masked credentials)
  - Query params (pretty JSON)
  - Response status
  - Response body (pre block, scrollable)
  - Response headers (collapsible)
  - **"Copy as curl" button** — generates `curl -X METHOD "URL" -u "ck_xxx:cs_xxx"` with the store's consumer key/secret substituted (or placeholder `$WC_KEY:$WC_SECRET` if user isn't super-admin) and copies to clipboard
  - **"Retry now" button** — for failed runs, resets status to `retrying` with `next_retry_at=now`

### Constraints
- Retries re-fetch from scratch; upsert makes this idempotent.
- Retry cron uses `UPDATE ... WHERE status='retrying' AND next_retry_at<=now() RETURNING id` with a conditional update to prevent duplicate retries when runs overlap.
- Don't retry auth errors (401/403) — they won't fix on retry. Retry network errors, 5xx, timeouts, rate-limit 429.
- Curl output must NOT leak consumer_secret unless requester is super-admin OR owns the store — fall back to `$WC_SECRET` placeholder.

## Checklist

- [x] Migration: add `attempt`, `next_retry_at`, `request_url`, `request_method`, `request_params`, `response_status`, `response_body`, `response_headers` columns to `sync_runs`; allow `retrying` in status check; add index `(status, next_retry_at)`
- [x] Error classifier `src/lib/sync-error.ts` with `isRetryableError(err, statusCode)` — retryable on network errors, 5xx, 408, 429, timeouts; NOT on 400/401/403/404
- [x] Wrap Woo client calls in `src/lib/woo-client.ts` so every error carries `{ url, method, params, status, body, headers }`
- [x] `src/pages/api/stores/[storeId]/sync.ts` and `src/pages/api/cron/sync-scheduler.ts`: on failure, persist all diagnostic columns; if retryable and attempt<5 mark `retrying` with backoff, else `failed`
- [x] New cron endpoint `src/pages/api/cron/sync-retry.ts` at `*/1 * * * *` picking due retrying runs, re-running aspect sync, updating `attempt`
- [x] Register retry cron in `vercel.json`
- [x] Sync-runs detail dialog shows: status + diagnostic block (Method/URL/Params/Response status/Response body/Headers) for failed runs
- [x] "Copy as curl" button generates a valid curl command with masked or real credentials based on user role
- [x] "Retry now" button on failed runs resets to `retrying` with `next_retry_at=now()`
- [x] Sync-runs table shows `retrying` status badge with countdown "Retrying in Xm (attempt N/5)"
- [x] `useActiveSync` treats `retrying` as still running so the top banner stays visible during backoff waits with message "Retrying in 2m… (attempt 3/5)"
- [x] Verify: simulate a 502 by pointing at wrong URL — confirm retries at 30s/2m/5m/15m, then permanent fail; confirm curl command reproduces the failure; verify 403 fails instantly (no retry)

## Acceptance

- A transient error triggers up to 4 retries with exponential backoff before permanent failure.
- Sync-runs detail dialog shows full request/response diagnostics for failed runs (URL, params, status, body, headers).
- "Copy as curl" produces a command that reproduces the exact failing Woo API call.
- "Retry now" button on failed rows re-triggers the sync immediately.
- Auth errors (401/403) skip retry entirely and show diagnostics for troubleshooting.
- Banner stays visible during retry waits with explanatory countdown.