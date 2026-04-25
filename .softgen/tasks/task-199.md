---
title: Chunked resumable sync engine
status: done
priority: urgent
type: feature
tags: [sync, infrastructure, reliability]
created_by: agent
created_at: 2026-04-25T21:00:00Z
position: 1
---

## Notes
Replaced the "one-shot, fail-on-timeout" sync model with a chunked, cursor-based, resumable engine driven by sync-scheduler cron. Each aspect is a state machine in `sync_runs` with `cursor_page` + `last_heartbeat_at`. One invocation processes up to MAX_PAGES_PER_INVOCATION then exits with status=`running` if more pages remain. Cron detects stale heartbeats and re-invokes with `resume=true`.

Code is live in production. DB schema verified compatible (cursor_page, total_pages, last_heartbeat_at all present in sync_runs).

## Checklist
- [x] DB migration: cursor_page, last_heartbeat_at, total_pages on sync_runs
- [x] sync-engine.ts: fetchPagesChunked() with heartbeat updates
- [x] sync.ts: per-aspect runAspect supporting resume=true
- [x] sync-scheduler.ts: detect stale-heartbeat running syncs and re-invoke
- [x] auto-fail-stuck.ts: switched to last_heartbeat_at threshold
- [x] Sanity test on large store

## Acceptance
- Large stores complete without single-invocation timeout
- Mid-run interruption resumes from last completed page
- Stuck-vs-slow distinction is correctly enforced