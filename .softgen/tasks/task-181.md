---
title: Remove @vercel/functions dependency
status: done
priority: urgent
type: bug
tags: [deploy, vercel]
created_by: agent
created_at: 2026-04-23T23:15:00Z
position: 1
---

## Notes
Build failing on Vercel because `@vercel/functions` isn't installed in the repo. Instead of installing it, remove the dependency — `waitUntil` is not required for fire-and-forget triggers to our own API endpoints. The target endpoint's HTTP handler starts executing as soon as the fetch request is sent, independent of whether the caller function keeps running.

Files using it:
- `src/pages/api/stores/[storeId]/sync-start.ts` — line 4 import, triggers `/api/stores/[storeId]/sync`
- `src/pages/api/stores/[storeId]/sync.ts` — line 7 import, triggers `/api/stores/[storeId]/sync-variations`

## Checklist
- [ ] Remove `import { waitUntil } from "@vercel/functions";` from `src/pages/api/stores/[storeId]/sync-start.ts`
- [ ] Remove the `waitUntil(syncPromise);` call in that file — keep the `fetch(...).catch(...)` as fire-and-forget
- [ ] Remove `import { waitUntil } from "@vercel/functions";` from `src/pages/api/stores/[storeId]/sync.ts`
- [ ] Remove the `waitUntil(variationsPromise);` call — keep `fetch(...).catch(...)` as fire-and-forget
- [ ] Verify build passes (no TypeScript errors, no missing module)

## Acceptance
- Vercel build completes without the "Cannot find module '@vercel/functions'" error
- Initial sync still triggers the variations sync endpoint after main sync completes
- `sync-start` endpoint still kicks off the full sync endpoint
