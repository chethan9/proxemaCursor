---
title: Incremental sync via modified_after watermarks
status: done
priority: urgent
type: feature
tags: [sync, performance, woocommerce, scalability]
created_by: agent
created_at: 2026-04-25T19:15:00Z
position: 197
---

## Notes

Large stores (12k+ customers/orders) hit the 30-min sync timeout because every cron run refetches every record from page 1. Solution: per-aspect watermark tracking + WooCommerce `modified_after` filter so subsequent syncs only pull changed records.

State table: `store_aspect_sync_state(store_id, aspect, last_synced_at, last_completed_at, records_seen)`. Updated atomically after each aspect completes.

WooCommerce supports `modified_after` on products/orders/customers. For categories/tags/coupons (no `modified_after` support) we still pull all but they're small (<500 typical).

First-ever sync (no watermark row) does a full fetch with no filter. After that, deltas only.

Also removes the silent `page > 50` data-loss cap in `fetchAllFromWooCommerce`.

## Checklist

- [x] Migration: `store_aspect_sync_state` table with PK (store_id, aspect), `last_synced_at` column, RLS service-role-only
- [x] Update `fetchAllFromWooCommerce` to accept `modifiedAfter` param and append `modified_after` to URL when present
- [x] Update each sync function (products/orders/customers/categories/tags/coupons) to: read watermark before, pass `modified_after`, write watermark after success
- [x] Remove `page > 50` hard cap in `fetchAllFromWooCommerce`
- [x] Surface watermark info in cron_logs metadata so ops can see "delta sync — 47 changes since 2026-04-25 18:00"

## Acceptance

- A 12k-customer store completes its second cron sync in under 30s when no customers changed
- A first-ever sync still pulls all records (no watermark row exists yet)
- If an aspect fails mid-sync, the watermark is NOT updated, so the next run re-pulls the same window