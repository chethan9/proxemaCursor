---
title: Fix @vercel/functions build error (reinstall dependency)
status: done
priority: urgent
type: bug
tags: [deploy, build-fix]
created_by: agent
created_at: 2026-04-23T23:38:00Z
position: 181
---

## Notes
Vercel build failed with:
```
./src/pages/api/stores/[storeId]/sync-start.ts:4:27
Type error: Cannot find module '@vercel/functions' or its corresponding type declarations.
```

Root cause: commit `ce8c50e` stripped `@vercel/functions` from dependencies, then revert `0cfd1cf` reintroduced the import in `sync-start.ts` without restoring the package.

**Fix applied:** `npm install @vercel/functions --save` → now pinned at `^3.4.4` in `package.json`. `sync-start.ts` already has the correct `import { waitUntil } from "@vercel/functions"` + `waitUntil(syncPromise)` pattern. `maxDuration: 300` in `vercel.json` governs the total window including background work.

## Checklist
- [x] Install `@vercel/functions` and confirm it's in `package.json` (now `^3.4.4`)
- [x] Verify `sync-start.ts` compiles with `waitUntil` import
- [x] check_for_errors passes

## Acceptance
- Vercel build no longer errors on missing `@vercel/functions` module.
- `POST /api/stores/:id/sync-start` returns immediately while background sync continues via `waitUntil`.