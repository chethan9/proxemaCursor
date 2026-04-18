---
title: Delete unused src/lib/cache.ts
status: todo
priority: low
type: chore
tags: [cleanup]
created_by: agent
created_at: 2026-04-18
position: 1
---

## Notes
Legacy localStorage-based cache utility (202 lines). Zero imports remain after React Query migration. Safe to delete — verified with grep across src/.

## Checklist
- [ ] Delete src/lib/cache.ts
- [ ] Run check_for_errors to confirm no broken references