---
title: Fix database structure - add tags table, fix coupons sync, add API tokens table
status: todo
priority: urgent
type: chore
tags: [database, schema]
created_by: agent
created_at: 2026-04-17T21:50:00Z
position: 7
---

## Notes
Database foundation is mostly solid (indexes exist) but missing critical tables for full vision:
- `tags` table (WooCommerce product tags) - missing entirely
- `api_tokens` table - for Flutter app secure access per client
- `site_health` computed values - cache health scores

Coupons table exists but sync populates 0 records - investigate why the WooCommerce `/coupons` endpoint response isn't matching our insert schema.

All new tables need:
- RLS enabled with T2 policy (public read, authenticated write) since this is an internal ops console
- Foreign keys with ON DELETE CASCADE
- Proper indexes on store_id, woo_id
- created_at/updated_at/synced_at timestamps

## Checklist
- [ ] Create `tags` table: id, store_id (FK), woo_id, name, slug, description, count, raw_data (jsonb), synced_at, created_at + unique(store_id, woo_id) + indexes
- [ ] Create `api_tokens` table: id, client_id (FK), token (unique), name, scopes (jsonb array), last_used_at, expires_at, created_at, revoked_at + index on token
- [ ] Add `health_score` (int 0-100) and `health_checked_at` columns to `stores` table
- [ ] Add `webhook_test_results` table: id, webhook_id (FK), store_id (FK), test_payload (jsonb), response_status, response_body, tested_at + index on webhook_id
- [ ] Enable RLS + T2 policies on all new tables
- [ ] Debug coupons sync - log raw WooCommerce response for /coupons, verify column mapping matches (especially `usage_limit_per_user` nullable, `amount` decimal parsing)
- [ ] Add composite index on sync_runs(store_id, status, started_at DESC) for dashboard queries
- [ ] Add GIN index on products.raw_data and orders.raw_data for JSON search
