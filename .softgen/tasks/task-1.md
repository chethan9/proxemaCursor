---
title: Database Schema Setup
status: done
priority: urgent
type: feature
tags: [database, schema, supabase]
created_by: agent
created_at: 2026-04-17
position: 1
---

## Notes
Set up the complete Postgres schema for the multi-tenant WooCommerce integration platform. Tables need proper relationships, RLS policies, and indexes.

## Checklist
- [x] Create clients table (id, name, created_at)
- [x] Create stores table (id, client_id FK, name, url, consumer_key, consumer_secret, status, last_sync_at)
- [x] Create sync_runs table (id, store_id FK, aspect, status, started_at, completed_at, records_processed, error_message)
- [x] Create webhook_events table (id, store_id FK, topic, payload, processed_at, created_at)
- [x] Set up RLS policies (public read/write for MVP, auth later)
- [x] Generate TypeScript types